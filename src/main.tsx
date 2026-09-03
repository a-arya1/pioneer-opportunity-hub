import React from 'react';import ReactDOM from 'react-dom/client';import {BrowserRouter,HashRouter} from 'react-router-dom';import App from './App';import './styles.css';import {AuthProvider} from './contexts/AuthContext';
const Router=import.meta.env.BASE_URL==='/'?BrowserRouter:HashRouter;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><Router><App/></Router></AuthProvider></React.StrictMode>);
