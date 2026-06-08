import { useState } from "react";

export default function ResourceHub({ classic }) {
  const [copiedMeta, setCopiedMeta] = useState(false);

  const handleCopyMetadata = () => {
    const text = `📌 ${classic.title} - ${classic.author}\n\n` +
                 `${classic.socialDescription}\n\n` +
                 `${classic.hashtags}`;
    navigator.clipboard.writeText(text);
    setCopiedMeta(true);
    setTimeout(() => setCopiedMeta(false), 2000);
  };

  const pronunciationData = [
    { rus: "Александр Пушкин", esp: "Aleksandr Pushkin", phonetics: "A-lek-sándr Push-kin", meaning: "Poeta central del romanticismo ruso" },
    { rus: "Михаил Лермонтов", esp: "Mijaíl Lérmontov", phonetics: "Mee-ja-íl Lér-mon-tof", meaning: "Poeta de tono nocturno y filosófico" },
    { rus: "Фёдор Тютчев", esp: "Fiódor Tiútchev", phonetics: "Fió-dor Tiút-chef", meaning: "Poeta del misterio interior" },
    { rus: "Николай Гоголь", esp: "Nikolái Gógol", phonetics: "Nee-ko-lái Gó-gol", meaning: "Narrador satírico y social" },
    { rus: "Антон Чехов", esp: "Antón Chéjov", phonetics: "An-tón Ché-jof", meaning: "Maestro del detalle emocional" },
    { rus: "Фёдор Достоевский", esp: "Fiódor Dostoyevski", phonetics: "Fió-dor Dos-to-yév-skee", meaning: "Novelista de psicología y melancolía" }
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
                  <tr key={index} className={classic.author.includes(item.esp) ? "highlight-row" : ""}>
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
              <p>{classic.socialDescription}</p>
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
              <li><strong>Ritmo visual:</strong> Cambia de plano cada 2 a 4 segundos, combina zoom lento, paneos suaves y texto grande para que el video siga vivo aunque el plano base sea una ilustración.</li>
              <li><strong>Formato de Audio:</strong> Mantén la voz al frente y la música muy baja, entre un 8% y 12%, para que el texto mande y la atmósfera acompañe.</li>
              <li><strong>Final en bucle:</strong> Cierra con una pregunta o una última línea que invite a volver al inicio; eso ayuda a la retención y mejora el rendimiento en plataformas.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
