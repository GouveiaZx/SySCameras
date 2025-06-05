/**
 * Wrapper para console que filtra warnings específicos de extensões do navegador
 */

const originalWarn = console.warn;
const originalError = console.error;

// Lista de padrões a serem suprimidos
const suppressedPatterns = [
  /bis_skin_checked/,
  /Extra attributes from the server/,
  /Warning: Extra attributes/,
];

// Wrapper para console.warn
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  
  // Verificar se deve suprimir este warning
  const shouldSuppress = suppressedPatterns.some(pattern => pattern.test(message));
  
  if (!shouldSuppress) {
    originalWarn.apply(console, args);
  }
};

// Wrapper para console.error (mais seletivo)
console.error = (...args: any[]) => {
  const message = args.join(' ');
  
  // Apenas suprimir erros muito específicos de extensões
  const shouldSuppress = suppressedPatterns.some(pattern => pattern.test(message));
  
  if (!shouldSuppress) {
    originalError.apply(console, args);
  }
};

export default {}; 
