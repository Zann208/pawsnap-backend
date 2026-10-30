// Demo-build notice: explains where data lives and offers a reset. Not part of the original app.
import React, { useEffect, useState } from "react";
import { resetDemo } from "firebase/firestore";

const onAuthRoute = () => ["", "#", "#/"].includes(window.location.hash);

export default function DemoBar() {
  const [authRoute, setAuthRoute] = useState(onAuthRoute());
  const [open, setOpen] = useState(onAuthRoute());
  useEffect(() => {
    // The router updates the hash with pushState, which fires no event, so poll lightly.
    let last = onAuthRoute();
    const t = setInterval(() => {
      const a = onAuthRoute();
      if (a !== last) { last = a; setAuthRoute(a); setOpen(a); }
    }, 300);
    return () => clearInterval(t);
  }, []);
  const pos = authRoute ? { left: 12, bottom: 12 } : { right: 12, bottom: 92 };
  const box = {
    position: "fixed", zIndex: 9999, maxWidth: "calc(100vw - 24px)", ...pos,
    font: "500 12px/1.45 system-ui, -apple-system, Segoe UI, sans-serif", color: "#3b2f2a",
    background: "rgba(255,255,255,.92)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,.12)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  };
  const btn = { border: 0, background: "none", padding: 0, font: "inherit", color: "#c0563b", fontWeight: 600, cursor: "pointer" };
  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ ...box, padding: "6px 11px", cursor: "pointer", fontWeight: 600 }}>Demo build</button>;
  }
  return (
    <div style={{ ...box, padding: "10px 12px" }} role="note">
      <b>Demo build</b> &middot; runs in your browser with sample data; nothing is sent anywhere.
      <br />Sign in as <b>demo@pawsnap.app</b> / <b>pawsnap</b>, or register any email.
      <br /><button style={btn} onClick={resetDemo}>Reset demo data</button>
      <span style={{ opacity: 0.4 }}> &middot; </span>
      <button style={{ ...btn, color: "#6b5e57" }} onClick={() => setOpen(false)}>Hide</button>
    </div>
  );
}
