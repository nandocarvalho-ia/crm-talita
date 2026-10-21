/** @type {import('tailwindcss').Config} */
// Cores da TCF Advogados (logo: verde #1F3630, dourado #D6BC6C e #7E6C32). Os nomes dos tokens são os do modelo.
// Contraste conferido (WCAG): branco/petroleo 12,9:1 · sol-700/sol-100 5,6:1 · noite/sol 6,4:1 · noite-600/branco 9,9:1 · apagado/branco 6,3:1.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Manrope', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // tinta escura (texto, botões escuros): quase-preto puxado para o verde da marca
        noite: { DEFAULT: '#0F1D19', 800: '#172A24', 700: '#22382F', 600: '#2F4840' },
        // verde da logo: cor principal (botões, links, gráficos)
        petroleo: { DEFAULT: '#1F3630', 700: '#152621', 300: '#8BA69B', 100: '#E2ECE6' },
        // dourado da logo: DEFAULT em barras, pontos e botão dourado; 300 (o dourado claro da logo) só em detalhes e anéis;
        // 700 é o texto dos chips sobre o 100
        sol: { DEFAULT: '#B8994A', 700: '#6E5D26', 300: '#D6BC6C', 100: '#F5EEDA' },
        // cores de estado: não mudam com a marca
        menta: { DEFAULT: '#52D3AC', 700: '#145E48', 600: '#1A7F62', 100: '#DDF3EA' },
        alerta: { DEFAULT: '#A33A22', 100: '#FBE7E1' },
        papel: '#EFF3EF',
        tinta: '#0F1D19',
        apagado: '#56635D',
        linha: 'rgba(15,29,25,.08)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,45,38,.05), 0 8px 24px rgba(20,45,38,.06)',
        painel: '0 24px 60px rgba(20,45,38,.14)',
      },
      borderRadius: { '4xl': '28px' },
    },
  },
  plugins: [],
};
