import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// Tratamento global de erros não capturados
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler] Erro não capturado:', event.error);
  // Aqui você pode enviar para um serviço de monitoramento
  // Ex: Sentry, LogRocket, etc.
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Error Handler] Promise rejeitada não tratada:', event.reason);
  // Prevenir que apareça no console do navegador
  event.preventDefault();
  // Aqui você pode enviar para um serviço de monitoramento
  // Ex: Sentry, LogRocket, etc.
});

createRoot(document.getElementById("root")!).render(<App />);

