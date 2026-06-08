import { useState } from "react"
import { Globe, Check } from "lucide-react"
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
import { SUPPORTED_AGENT_LANGUAGES } from "../../lib/agent-language"
import { cn } from "../../lib/utils"
import { useTranslation } from "react-i18next"

const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'zh-CN': '中文 (简体)',
  'ja-JP': '日本語',
  'ru-RU': 'Русский',
}

const languages = SUPPORTED_AGENT_LANGUAGES.map((lang) => ({
  code: lang.code,
  name: lang.name,
  nativeName: NATIVE_LANGUAGE_NAMES[lang.code] || lang.name,
}))

export function LanguageSelector() {
  const { t } = useTranslation("common")
  const { currentLanguage, changeLanguage, isLoading } = useUserLanguage()
  const [open, setOpen] = useState(false)

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) {
      setOpen(false)
      return
    }

    try {
      setOpen(false)
      await changeLanguage(languageCode)
    } catch (error) {
      console.error('[LanguageSelector] Erro ao mudar idioma:', error)
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
          disabled={isLoading}
        >
          <Globe className="h-4 w-4" />
          <span className="sr-only">{t("language.selectAria")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        <Command>
          <CommandInput placeholder={t("language.search")} />
          <CommandList>
            <CommandEmpty>{t("language.empty")}</CommandEmpty>
            <CommandGroup>
              {languages.map((language) => (
                <CommandItem
                  key={language.code}
                  value={`${language.code} ${language.nativeName} ${language.name}`}
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
