import React from 'react';
import './globals.css';
import ServiceWorkerRegister from './sw-register';

export const metadata = {
  title: 'KDLGOODS – 30-Minute Hyper-Local Delivery | Kirandul, Dantewada',
  description:
    'KDLGOODS delivers groceries, food, and essentials in under 30 minutes across Kirandul, Dantewada Chhattisgarh. Order from nearby stores and track your rider in real time.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi">
      <head>
        {/* Blinkit brand yellow theme color for mobile browser chrome */}
        <meta name="theme-color" content="#F7D108" />
        <meta name="application-name" content="KDLGOODS" />
        <meta name="geo.region" content="IN-CT" />
        <meta name="geo.placename" content="Dantewada, Chhattisgarh, India" />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
