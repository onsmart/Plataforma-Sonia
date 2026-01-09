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

export function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
    } catch (error: any) {
      if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
          console.error("Login error:", error);
      }
      let message = "Ocorreu um erro ao fazer login.";
      
      // Tradução amigável dos erros comuns do Supabase
      if (error.message.includes("Invalid login credentials")) {
        message = "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
      } else if (error.message.includes("Too many requests")) {
        message = "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
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
      // Using the server-side signup route as per system instructions for auto-confirmation
      let response;
      try {
          response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-eeb342a4/signup`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({ email, password }),
          });
      } catch (fetchError: any) {
          if (fetchError.name === 'TypeError' && fetchError.message === 'Failed to fetch') {
              throw new Error("Erro de conexão. Verifique sua internet.");
          }
          throw fetchError;
      }

      if (!response.ok) {
        const text = await response.text();
        console.error("Erro bruto do servidor de cadastro:", text);
        
        let errorMessage = text;
        try {
            const json = JSON.parse(text);
            if (json.error) errorMessage = json.error;
        } catch(e) {
             // Se não for JSON, usa o texto puro
        }

        // Tratamento de mensagens comuns do Supabase para Português
        if (errorMessage.includes("User already registered") || errorMessage.includes("already has been registered")) {
            errorMessage = "Este e-mail já possui cadastro. Tente fazer login.";
        } else if (errorMessage.includes("Password should be at least")) {
            errorMessage = "A senha deve ter no mínimo 6 caracteres.";
        } else if (errorMessage.includes("valid email")) {
            errorMessage = "Por favor, insira um e-mail válido.";
        }

        throw new Error(errorMessage);
      }

      // After creation, try to sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) throw signInError;
      
      toast.success("Conta criada com sucesso!");
    } catch (error: any) {
      if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
          console.error(error);
      }
      let message = error.message || "Erro ao registrar.";
      
      if (message.includes("User already registered")) {
          message = "Este e-mail já está cadastrado. Tente fazer login.";
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
