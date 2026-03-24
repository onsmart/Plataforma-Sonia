import { useState, useEffect } from "react"
import { Globe, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "./button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import { useUserLanguage } from "../../hooks/useUserLanguage"
import { supabase } from "../../utils/supabase/client"
import { cn } from "../../lib/utils"

interface Language {
  code: string
  name: string
  nativeName: string
}

/** Idiomas com seeds em BackEnd/traducoes (tb_i18n_translations). Outros = UI sem traduções no banco. */
const defaultLanguages: Language[] = [
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)' },
  { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español (España)' },
]

export function LanguageSelector() {
  const { currentLanguage, changeLanguage, isLoading } = useUserLanguage()
  const [open, setOpen] = useState(false)
  const [languages, setLanguages] = useState<Language[]>(defaultLanguages)
  const [loading, setLoading] = useState(true)

  // Buscar linguas suportadas do banco
  useEffect(() => {
    async function fetchSupportedLanguages() {
      try {
        // Buscar linguas únicas da tabela de traduções
        const { data, error } = await supabase
          .from('tb_i18n_translations')
          .select('language')
          .eq('is_active', true)
          .order('language', { ascending: true })

        if (error) {
          console.error('[LanguageSelector] Erro ao buscar linguas:', error)
          setLanguages(defaultLanguages)
          setLoading(false)
          return
        }

        if (data && data.length > 0) {
          // Extrair linguas únicas
          const uniqueLanguages = Array.from(new Set(data.map(item => item.language)))
          
          // Mapear para objetos Language
          const supportedLanguages = uniqueLanguages
            .map(code => {
              const lang = defaultLanguages.find(l => l.code === code)
              return lang || {
                code,
                name: code,
                nativeName: code
              }
            })
            .filter(Boolean) as Language[]

          // Garantir que os idiomas padrão principais sempre estejam presentes
          // (pt-BR, en-US, es-ES) mesmo que não existam traduções no banco
          const essentialLanguages = [
            defaultLanguages.find(l => l.code === 'pt-BR'),
            defaultLanguages.find(l => l.code === 'en-US'),
            defaultLanguages.find(l => l.code === 'es-ES')
          ].filter(Boolean) as Language[]

          // Combinar idiomas essenciais com os encontrados no banco
          const allLanguages = [...essentialLanguages]
          
          // Adicionar outros idiomas encontrados no banco que não são essenciais
          supportedLanguages.forEach(lang => {
            if (!allLanguages.some(l => l.code === lang.code)) {
              allLanguages.push(lang)
            }
          })

          // Ordenar: primeiro os essenciais, depois os outros
          const finalLanguages = [
            ...essentialLanguages,
            ...allLanguages.filter(l => !essentialLanguages.some(e => e.code === l.code))
          ]
          
          setLanguages(finalLanguages)
        } else {
          // Se não houver traduções no banco, usar linguas padrão
          // Garantir que pt-BR, en-US e es-ES estejam presentes
          setLanguages(defaultLanguages)
        }
      } catch (error) {
        console.error('[LanguageSelector] Erro ao buscar linguas:', error)
        setLanguages(defaultLanguages)
      } finally {
        setLoading(false)
      }
    }

    fetchSupportedLanguages()
  }, [])

  const selectedLanguage = languages.find(lang => lang.code === currentLanguage) || languages[0]

  const handleLanguageChange = async (languageCode: string) => {
    // Se já está no mesmo idioma, não fazer nada
    if (languageCode === currentLanguage) {
      setOpen(false)
      return
    }

    try {
      // Fechar o popover primeiro
      setOpen(false)
      
      // Atualizar idioma no banco e no i18n
      // O App.tsx já está gerenciando o loading através do isChangingLanguage
      // A página só será liberada quando todas as traduções estiverem carregadas
      await changeLanguage(languageCode)
      
      // Não precisa mais recarregar a página!
      // O loading será gerenciado automaticamente e a tela será atualizada
      // quando todas as traduções estiverem prontas
    } catch (error) {
      console.error('[LanguageSelector] Erro ao mudar idioma:', error)
      // Reabrir o popover em caso de erro
      setOpen(true)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          disabled={isLoading || loading}
        >
          <Globe className="h-4 w-4" />
          <span className="sr-only">Select language</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search language..." />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {languages.map((language) => (
                <CommandItem
                  key={language.code}
                  value={language.code}
                  onSelect={() => handleLanguageChange(language.code)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentLanguage === language.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{language.nativeName}</span>
                    <span className="text-xs text-muted-foreground">{language.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
