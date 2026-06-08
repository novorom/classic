import React, { useState } from "react";

export default function ResourceHub({ classic }) {
  const [copiedMeta, setCopiedMeta] = useState(false);

  const handleCopyMetadata = () => {
    const text = `📌 ${classic.title} - ${classic.author}\n\n` +
                 `¿Conocías este gran clásico de la literatura rusa? Déjame saber tu opinión en comentarios. 👇\n\n` +
                 `${classic.hashtags}`;
    navigator.clipboard.writeText(text);
    setCopiedMeta(true);
    setTimeout(() => setCopiedMeta(false), 2000);
  };

  const pronunciationData = [
    { rus: "Фёдор Достоевский", esp: "Fiódor Dostoyevski", phonetics: "Fió-dor Dos-to-yév-skee", meaning: "Autor de Crimen y castigo" },
    { rus: "Лев Толстой", esp: "Lev Tolstói", phonetics: "Léf Tal-stóy", meaning: "Autor de Guerra y paz" },
    { rus: "Михаил Булгаков", esp: "Mijaíl Bulgákov", phonetics: "Mee-ja-éel Bool-gá-kof", meaning: "Autor de El maestro y Margarita" },
    { rus: "Родион Раскольников", esp: "Rodión Raskólnikov", phonetics: "Ro-dión Ras-kól-nee-kof", meaning: "Protagonista de Crimen y castigo" },
    { rus: "Пьер Безухов", esp: "Pierre Bezújov", phonetics: "Piair Be-zóo-jof", meaning: "Protagonista de Guerra y paz" },
    { rus: "Бегемот", esp: "Behemot", phonetics: "Be-je-mót (con j suave)", meaning: "El gato demoníaco en Bulgákov" }
  ];

  return (
    <div className="resource-hub-container card-premium">
      <h3 className="section-title">
        <span className="sparkle">📚</span> Centro de Recursos y Estrategia
      </h3>

      <div className="resource-grid">
        {/* Pronunciation Section */}
        <div className="resource-section">
          <h4>🗣️ Guía de Pronunciación Rusa</h4>
          <p className="help-text">
            Pronunciar bien los nombres rusos da mucha credibilidad y profesionalismo a tu video. Aquí tienes una guía rápida:
          </p>
          <div className="pronunciation-table-wrapper">
            <table className="pronunciation-table">
              <thead>
                <tr>
                  <th>Nombre Escrito</th>
                  <th>Fonética en Español</th>
                  <th>Rol / Detalle</th>
                </tr>
              </thead>
              <tbody>
                {pronunciationData.map((item, index) => (
                  <tr key={index} className={classic.author.includes(item.esp.split(" ")[1]) || classic.title.includes(item.meaning) ? "highlight-row" : ""}>
                    <td><strong>{item.esp}</strong> <span className="russian-char">{item.rus}</span></td>
                    <td><span className="phonetics-badge">{item.phonetics}</span></td>
                    <td>{item.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SEO & Social Media Metadata Section */}
        <div className="resource-section">
          <h4>📱 SEO y Metadatos para Redes</h4>
          <p className="help-text">
            Descripción y etiquetas optimizadas para maximizar el algoritmo en TikTok, Reels y Shorts:
          </p>
          <div className="metadata-box">
            <div className="metadata-preview">
              <strong>Descripción propuesta:</strong>
              <p>¿Conocías este gran clásico de la literatura rusa? Déjame saber tu opinión en comentarios. 👇</p>
              <strong>Hashtags recomendados:</strong>
              <p className="hashtags-list">{classic.hashtags}</p>
            </div>
            <button 
              className={`copy-btn secondary ${copiedMeta ? "copied" : ""}`}
              onClick={handleCopyMetadata}
            >
              {copiedMeta ? "¡Copiado! ✓" : "Copiar Descripción + Hashtags"}
            </button>
          </div>

          <div className="posting-tips">
            <h5>💡 Consejos de Retención y Formato:</h5>
            <ul>
              <li><strong>Los 3 primeros segundos:</strong> La frase de gancho debe estar escrita en grande en la pantalla al iniciar el video. No saludes ni te presentes. ¡Entra directo al grano!</li>
              <li><strong>Formato de Audio:</strong> Si usas la voz sintética, asegúrate de añadir la música clásica sugerida a volumen muy bajo (entre un 8% y 12%) para crear atmósfera.</li>
              <li><strong>Final en bucle:</strong> El guion está diseñado para conectar de manera fluida el final con el inicio, lo que incrementa el tiempo de retención del espectador (bucle infinito).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
