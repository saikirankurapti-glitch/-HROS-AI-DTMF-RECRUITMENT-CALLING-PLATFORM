import eslint from 'eslint';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  ...tseslint.configs.recommended,
  {ignores:['dist/**']},
  {rules:{'@typescript-eslint/no-explicit-any':'off'}}
);
