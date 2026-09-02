import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
export default tseslint.config({ignores:['dist','.tmp','src/data/opportunities.json']},js.configs.recommended,...tseslint.configs.recommended,{files:['**/*.{ts,tsx}'],languageOptions:{ecmaVersion:2022,globals:{...globals.browser,...globals.node}},plugins:{'react-hooks':reactHooks,'react-refresh':reactRefresh},rules:{...reactHooks.configs.recommended.rules,'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-expressions':'off','react-refresh/only-export-components':['warn',{allowConstantExport:true}]}});
