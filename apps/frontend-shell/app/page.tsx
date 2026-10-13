import Link from "next/link";
import {
  ArrowRight,
  Building2,
  BusFront,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Globe2,
  HelpCircle,
  MapPin,
  MapPinned,
  Navigation,
  PackageCheck,
  Phone,
  Route,
  Search,
  Smartphone,
  TicketCheck
} from "lucide-react";
import { CookieConsentBanner } from "./components/CookieConsentBanner";

const heroImageUrl = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=2200&q=80";

const trustStats = [
  { label: "70 años", text: "de experiencia conectando familias" },
  { label: "100+", text: "unidades modernas para rutas seguras" },
  { label: "35+", text: "oficinas y salas VIP" },
  { label: "Nacional e internacional", text: "cobertura para viajar mas lejos" }
];

const services = [
  { icon: TicketCheck, title: "Pasajes en linea", text: "Compra visual para reservar tu viaje con origen, destino, fecha y horario." },
  { icon: Route, title: "Viajes nacionales", text: "Conexion entre las principales ciudades y terminales del Ecuador." },
  { icon: Globe2, title: "Viajes internacionales", text: "Rutas para cruzar fronteras con una experiencia ordenada y confiable." },
  { icon: PackageCheck, title: "Encomiendas", text: "Envio de paquetes y documentos con puntos de atencion autorizados." },
  { icon: Search, title: "Rastreo de encomiendas", text: "Consulta visual del estado de tus envios cuando el modulo este integrado." },
  { icon: FileText, title: "Facturacion electronica", text: "Acceso preparado para descargar comprobantes y respaldos de compra." }
];

const destinations = [
  "Quito",
  "Guayaquil",
  "Machala",
  "Ambato",
  "Manta",
  "Esmeraldas",
  "Tulcan",
  "Riobamba",
  "Santo Domingo",
  "Huaquillas"
];

const purchaseSteps = [
  { icon: MapPinned, title: "Elige origen y destino", text: "Busca tu ruta ideal segun la ciudad de salida y llegada." },
  { icon: Clock3, title: "Selecciona fecha y hora", text: "Compara horarios disponibles antes de confirmar el viaje." },
  { icon: CreditCard, title: "Elige forma de pago", text: "Deja listo el flujo para tarjetas, transferencias o canales autorizados." },
  { icon: CheckCircle2, title: "Descarga tu ticket", text: "Recibe el respaldo digital para abordar con mayor comodidad." }
];

const offices = [
  { city: "Quito", address: "Direccion editable de oficina principal", phone: "Telefono editable" },
  { city: "Guayaquil", address: "Direccion editable de agencia o terminal", phone: "Telefono editable" },
  { city: "Machala", address: "Direccion editable de agencia regional", phone: "Telefono editable" }
];

const faqs = [
  {
    answer: "La landing deja preparado el flujo visual para pago en linea. Cuando se conecte el backend, se podran habilitar los metodos definidos por la empresa.",
    question: "Como puedo pagar?"
  },
  {
    answer: "El objetivo es entregar un ticket digital descargable despues de confirmar la compra. Por ahora el boton es visual y no ejecuta una transaccion real.",
    question: "Como recibo mis boletos?"
  },
  {
    answer: "El cambio de boleto debe seguir las politicas comerciales de la empresa. Esta landing reserva el espacio para enlazar esa gestion cuando exista el modulo.",
    question: "Puedo cambiar mi boleto?"
  }
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#inicio" aria-label="Panamericana Internacional">
          <span>
            <BusFront aria-hidden="true" size={22} />
          </span>
          <strong>Panamericana Internacional</strong>
        </a>
        <nav className="landing-links" aria-label="Navegacion publica">
          <a href="#inicio">Inicio</a>
          <a href="#servicios">Servicios</a>
          <a href="#destinos">Destinos</a>
          <a href="#oficinas">Oficinas</a>
          <a href="#app">App</a>
          <a href="#preguntas">Preguntas frecuentes</a>
          <Link href="/login">Ingresar</Link>
        </nav>
      </header>

      <section
        className="landing-hero"
        id="inicio"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(33, 5, 12, 0.86), rgba(82, 11, 28, 0.56), rgba(82, 11, 28, 0.18)), url("${heroImageUrl}")`
        }}
      >
        <div className="hero-content">
          <p className="landing-eyebrow">Transporte terrestre de pasajeros y encomiendas</p>
          <h1>Panamericana Internacional</h1>
          <strong>Uniendo fronteras y familias</strong>
          <p>
            Compra pasajes, viaja seguro y conecta con los principales destinos nacionales e internacionales desde una experiencia digital moderna.
          </p>
          <div className="hero-actions">
            <a className="landing-button landing-button-primary" href="#comprar">
              Comprar pasaje
              <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a className="landing-button landing-button-secondary" href="#servicios">
              Rastrear encomienda
            </a>
          </div>
        </div>
      </section>

      <section className="trust-band" aria-label="Indicadores de confianza">
        {trustStats.map((item) => (
          <article key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </section>

      <section className="landing-section" id="servicios">
        <div className="section-heading">
          <p className="landing-eyebrow">Servicios</p>
          <h2>Todo el viaje en un solo punto digital</h2>
          <p>Canales pensados para comprar, consultar y gestionar servicios de transporte sin perder claridad operativa.</p>
        </div>
        <div className="service-grid">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article className="service-item" key={service.title}>
                <Icon aria-hidden="true" size={24} />
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="destination-section" id="destinos">
        <div className="section-heading">
          <p className="landing-eyebrow">Destinos</p>
          <h2>Rutas para conectar Ecuador y la region</h2>
          <p>Principales ciudades destacadas para iniciar la experiencia publica de compra y consulta.</p>
        </div>
        <div className="destination-grid">
          {destinations.map((destination) => (
            <a href="#comprar" key={destination}>
              <Navigation aria-hidden="true" size={17} />
              <span>{destination}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="landing-section purchase-section" id="comprar">
        <div className="section-heading">
          <p className="landing-eyebrow">Compra guiada</p>
          <h2>Como comprar un boleto</h2>
          <p>Flujo preparado para conectarse con los modulos transaccionales cuando la integracion este disponible.</p>
        </div>
        <div className="step-grid">
          {purchaseSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article className="step-item" key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon aria-hidden="true" size={24} />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="digital-section" id="app">
        <div>
          <p className="landing-eyebrow">App y canales digitales</p>
          <h2>Gestiona tu viaje desde cualquier lugar</h2>
          <p>
            Espacio reservado para enlazar la app movil, compra de pasajes, rastreo de encomiendas y descarga de comprobantes cuando esten integrados.
          </p>
        </div>
        <a className="store-button" href="#inicio">
          <Smartphone aria-hidden="true" size={23} />
          <span>
            Disponible en
            <strong>Google Play</strong>
          </span>
        </a>
      </section>

      <section className="landing-section" id="oficinas">
        <div className="section-heading">
          <p className="landing-eyebrow">Oficinas</p>
          <h2>Atencion presencial en puntos clave</h2>
          <p>Datos editables para completar con direcciones y telefonos oficiales de cada agencia.</p>
        </div>
        <div className="office-grid">
          {offices.map((office) => (
            <article className="office-item" key={office.city}>
              <Building2 aria-hidden="true" size={24} />
              <h3>{office.city}</h3>
              <p>
                <MapPin aria-hidden="true" size={15} />
                {office.address}
              </p>
              <p>
                <Phone aria-hidden="true" size={15} />
                {office.phone}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="faq-section" id="preguntas">
        <div className="section-heading">
          <p className="landing-eyebrow">Preguntas frecuentes</p>
          <h2>Informacion clara antes de viajar</h2>
        </div>
        <div className="faq-list">
          {faqs.map((faq) => (
            <article key={faq.question}>
              <HelpCircle aria-hidden="true" size={21} />
              <div>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>Panamericana Internacional</strong>
          <span>Uniendo fronteras y familias</span>
        </div>
        <nav aria-label="Links rapidos">
          <a href="#servicios">Servicios</a>
          <a href="#destinos">Destinos</a>
          <a href="#oficinas">Oficinas</a>
        </nav>
        <address>
          <span>Contacto editable</span>
          <span>info@panamericana.example</span>
        </address>
        <small>Copyright {new Date().getFullYear()} Panamericana Internacional. Todos los derechos reservados.</small>
      </footer>
      <CookieConsentBanner />
    </main>
  );
}
