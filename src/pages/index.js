
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { useState, useEffect } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Función para convertir la clave VAPID de base64url a un Uint8Array
function urlBase64ToUint8Array(base64String) {
  if (typeof window === 'undefined') return;
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Home() {
  // States for Push Notifications
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [registration, setRegistration] = useState(null);

  // State for Welcome Modal
  const [showWelcome, setShowWelcome] = useState(true);

  // State for Event Count
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    // Fetch event count
    fetch('/api/events/count')
      .then(res => res.json())
      .then(data => {
        if (data.total) {
          setEventCount(data.total);
        }
      })
      .catch(console.error);

    // Service Worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(reg => {
          setRegistration(reg);
          console.log("Service worker registrado", reg);
          reg.pushManager.getSubscription().then(sub => {
            if (sub) {
              console.log("Usuario ya está suscrito.", sub);
              setSubscription(sub);
              setIsSubscribed(true);
            }
          });
        })
        .catch(err => console.error("Error al registrar el service worker", err));
    }
  }, []);

  const subscribeUser = async () => {
    if (!registration) {
      console.error("Service worker no registrado.");
      return;
    }
    
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
        console.error("La VAPID public key no está definida en las variables de entorno.");
        alert("Error de configuración: La clave VAPID pública no está disponible.");
        return;
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    try {
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      console.log("Usuario suscrito exitosamente.", sub);

      await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sub),
      });

      setSubscription(sub);
      setIsSubscribed(true);
      // Opcional: cerrar el modal tras suscribirse
      // setShowWelcome(false); 
    } catch (err) {
      console.error("Error al suscribir al usuario:", err);
    }
  };

  const unsubscribeUser = async () => {
    if (subscription) {
      try {
        await subscription.unsubscribe();
        console.log("Suscripción cancelada en el navegador.");

        await fetch("/api/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        setSubscription(null);
        setIsSubscribed(false);
      } catch (err) {
        console.error("Error al cancelar la suscripción:", err);
      }
    }
  };

  const handleCloseWelcome = () => {
    setShowWelcome(false);
  };

  return (
    <div
      className={`${geistSans.className} ${geistMono.className} font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20`}
    >
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        
        <div className="w-full text-center mb-4">
          <p className="text-lg">
            Tenemos: <span className="font-bold text-xl">{eventCount}</span> eventos en nuestro buscador
          </p>
        </div>

        {/* Contenido principal de la página */}
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
              src/pages/index.js
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>

      {/* --- Modal de Bienvenida con Suscripción Integrada --- */}
      {showWelcome && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', textAlign: 'center', color: 'black', maxWidth: '400px' }}>
            <span onClick={handleCloseWelcome} style={{ float: 'right', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</span>
            <h2 style={{ marginTop: 0 }}>¡Bienvenido a Duende Finder!</h2>
            <p>Tu guía para encontrar los mejores eventos de flamenco.</p>
            <p>Para no perderte ninguna novedad, activa las notificaciones.</p>
            
            <button 
                onClick={isSubscribed ? unsubscribeUser : subscribeUser}
                className={`rounded-full font-medium text-sm sm:text-base h-12 px-6 transition-colors ${isSubscribed ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                disabled={!registration}
            >
                {isSubscribed ? 'Cancelar Suscripción' : 'Activar Notificaciones'}
            </button>
            {!registration && <p className="text-xs text-gray-500 mt-2">Inicializando...</p>}

            <button onClick={handleCloseWelcome} style={{ marginTop: '10px', marginLeft: '10px', background: 'grey', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer' }}>
              Explorar
            </button>
          </div>
        </div>
      )}

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
