/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Manrope', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // tinta escura (texto, botões escuros)
        noite: { DEFAULT: '#0B2229', 800: '#12333B', 700: '#1B434C', 600: '#26545E' },
        // azul-petróleo: cor principal da marca no painel
        petroleo: { DEFAULT: '#0E5E6B', 700: '#0A4650', 300: '#7FA6AE', 100: '#DDEEF1' },
        sol: { DEFAULT: '#F2B01E', 700: '#6B4700', 300: '#F7C94F', 100: '#FCEFCB' },
        menta: { DEFAULT: '#52D3AC', 700: '#145E48', 600: '#1A7F62', 100: '#DDF3EA' },
        alerta: { DEFAULT: '#A33A22', 100: '#FBE7E1' },
        papel: '#EEF3F4',
        tinta: '#0B2229',
        apagado: '#51646A',
        linha: 'rgba(11,34,41,.08)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,60,80,.05), 0 8px 24px rgba(14,60,80,.06)',
        painel: '0 24px 60px rgba(14,60,80,.14)',
      },
      borderRadius: { '4xl': '28px' },
    },
  },
  plugins: [],
};
