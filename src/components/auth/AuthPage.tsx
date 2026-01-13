import React, { useState } from "react";
import { supabase } from "../../utils/supabase/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { toast } from "sonner@2.0.3";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Criptografa a senha usando SHA-256 antes de enviar ao servidor
 */
async function encryptPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const { navigate } = useNavigation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Fazer login no Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      // O AuthContext irá automaticamente buscar os dados do usuário via onAuthStateChange
      toast.success("Bem-vindo de volta!");
      navigate("cockpit");

      
    } catch (error: any) {
      if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
          console.error("Login error:", error);
      }
      let message = "Ocorreu um erro ao fazer login.";
      
      // Tradução amigável dos erros
      if (error.message?.includes("Invalid login credentials") || error.message?.includes("credenciais inválidas") || error.message?.includes("usuário não encontrado")) {
        message = "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";
      } else if (error.message?.includes("Email not confirmed")) {
        message = "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
      } else if (error.message?.includes("Too many requests")) {
        message = "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
      } else if (error.message) {
        message = error.message;
      }
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Validar campos obrigatórios
      if (!firstName.trim()) {
        throw new Error("O nome é obrigatório.");
      }
      if (!lastName.trim()) {
        throw new Error("O sobrenome é obrigatório.");
      }
      if (password.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
      }

      // PASSO 1: Criar usuário no Supabase Auth primeiro
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: undefined,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim()
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Falha ao criar usuário no sistema de autenticação.");
      }

      // PASSO 2: Criptografar senha e criar registro na base de dados usando a stored procedure
      const encryptedPassword = await encryptPassword(password);
      
      const { data, error } = await supabase.rpc('sp_create_user', {
        p_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: email.trim(),
        p_password: encryptedPassword
      });

      if (error) {
        // Se falhar ao criar na base de dados, tentar remover o usuário do Auth
        // (opcional - pode deixar para limpeza manual)
        console.error("Erro ao criar usuário na base de dados:", error);
        throw error;
      }

      // Se tudo deu certo, fazer login automático
      if (data && data.success !== false) {
        // Fazer login para obter a sessão
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        
        if (signInError) {
          console.warn("Usuário criado mas login automático falhou:", signInError);
          toast.success("Conta criada com sucesso! Por favor, faça login.");
          // Reset form
          setFirstName("");
          setLastName("");
          setEmail("");
          setPassword("");
        } else {
          // O AuthContext irá automaticamente buscar os dados do usuário via onAuthStateChange
          toast.success("Conta criada com sucesso!");
          navigate("cockpit");
        }
      } else {
        throw new Error(data?.message || "Falha ao criar usuário na base de dados");
      }
      
    } catch (error: any) {
      if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
          console.error("Register error:", error);
      }
      let message = error.message || "Erro ao registrar.";
      
      // Tradução amigável dos erros
      if (message.includes("User already registered") || message.includes("já cadastrado") || message.includes("já existe") || message.includes("already registered")) {
          message = "Este e-mail já está cadastrado. Tente fazer login.";
      } else if (message.includes("Password should be at least") || message.includes("mínimo 6")) {
          message = "A senha deve ter no mínimo 6 caracteres.";
      } else if (message.includes("valid email") || message.includes("e-mail válido") || message.includes("Invalid email")) {
          message = "Por favor, insira um e-mail válido.";
      }
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SONIA Enterprise</h1>
          <p className="text-sm text-muted-foreground">
            Plataforma de Orquestração de Agentes IA
          </p>
        </div>

        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro de Autenticação</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Cadastro</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Acessar Plataforma</CardTitle>
                <CardDescription>
                  Entre com seu e-mail corporativo para continuar.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="nome@empresa.com" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Nova Conta</CardTitle>
                <CardDescription>
                  Crie sua conta Enterprise para começar.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-firstname">Nome</Label>
                      <Input 
                        id="register-firstname" 
                        type="text" 
                        placeholder="João" 
                        required 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-lastname">Sobrenome</Label>
                      <Input 
                        id="register-lastname" 
                        type="text" 
                        placeholder="Silva" 
                        required 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-mail</Label>
                    <Input 
                      id="register-email" 
                      type="email" 
                      placeholder="nome@empresa.com" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
                    <Input 
                      id="register-password" 
                      type="password" 
                      required 
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Conta
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
        
        <p className="px-8 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Termos de Serviço
          </a>{" "}
          e{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </div>
  );
}
