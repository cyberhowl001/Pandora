// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import Chat from './chat.jsx'
// import Chat from './Form.jsx'
// import "./index.css"
// import ErrorBoundary from './ErrorBoundary.jsx'




// createRoot(document.getElementById('root')).render(

//   <StrictMode>
// <ErrorBoundary>
//    <Chat />
//  </ErrorBoundary>
//   </StrictMode>
// )


import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";                                                                                                                                                                                                                                                                                                                                                                                                                    
import "./index.css";  // keep your Tailwind import here

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);