/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Logonun yeşili — markanın ana rengi
        primary: {
          DEFAULT: '#197060',
          50: '#eaf6f3',
          100: '#c9e9e1',
          200: '#96d5c7',
          300: '#5cbba7',
          400: '#2d9b85',
          500: '#197060', // Logodan alınan esas renk
          600: '#145c4f',
          700: '#114a40',
          800: '#0f3b34',
          900: '#0d2f2a',
          950: '#061613',
        },
        // Logonun altın sarısı — vurgu rengi
        accent: {
          DEFAULT: '#c5a23a',
          50: '#fbf7ea',
          100: '#f5ebc7',
          200: '#ecd991',
          300: '#e0c25b',
          400: '#d3ae42',
          500: '#c5a23a', // Logodan alınan esas renk
          600: '#a4832c',
          700: '#806425',
          800: '#5f4a20',
          900: '#45351a',
          950: '#241b0d',
        },
        // Logonun grisinden türetilmiş, hafif yeşile çalan nötr skala
        dark: {
          DEFAULT: '#0d1211',
          50: '#f6f7f7',
          100: '#e6e9e8',
          200: '#cdd2d0',
          300: '#a8afad',
          400: '#7e8684',
          500: '#636b69',
          600: '#52514f', // Logodan alınan gri
          700: '#43423f',
          800: '#2c302f',
          900: '#1b201f',
          950: '#0d1211', // En koyu — uygulama arka planı
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translate(-50%, -16px)' },
          to: { opacity: '1', transform: 'translate(-50%, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'slide-down': 'slide-down 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
