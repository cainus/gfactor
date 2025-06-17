// Make this file a module by adding an export
export {};

// Add the global type declaration
declare global {
  interface Window {
    logAppInitialized?: boolean;
  }
}

// This file is intentionally empty to avoid conflicts with the LogWindow component
// We're not initializing a separate React application here
console.log('sidebar-react-app.tsx loaded, but not initializing a separate React application');

// Add the missing type declaration for our global flag
declare global {
  interface Window {
    logAppInitialized?: boolean;
  }
}