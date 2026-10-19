import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',fs:{strict:true,deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.local/**','**/docs/**','**/db/**','**/server/**','**/scripts/**','**/tests/**','**/*.{xlsx,zip}']},proxy:{'/api':'http://127.0.0.1:3001'}},build:{sourcemap:false}});
