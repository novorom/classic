import { useState } from "react";
import { channelData } from "../data/channelData";

export default function YouTubeMetadataGenerator({ classic }) {
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedThumbnail, setCopiedThumbnail] = useState(false);

  // Генерация заголовка для YouTube
  const generateVideoTitle = () => {
    const hooks = [
      `¿Por qué "${classic.title}" es el mejor libro ruso?`,
      `El secreto oculto de "${classic.title}"`,
      `"${classic.title}" explicado en 5 minutos`,
      `Lo que nadie te dice sobre "${classic.title}"`,
      `${classic.title}: El libro que cambiará tu vida`,
      `La verdad sobre ${classic.author} y "${classic.title}"`
    ];
    return hooks[Math.floor(Math.random() * hooks.length)];
  };

  // Генерация описания для YouTube
  const generateVideoDescription = () => {
    return `📚 ${classic.title} - ${classic.author} 📚

${classic.mood}

En este video descubrirás:
✅ El argumento principal de "${classic.title}"
✅ Por qué este libro es considerado un clásico de la literatura rusa
✅ Curiosidades sobre ${classic.author} que no conocías
✅ Cómo este libro puede cambiar tu perspectiva de la vida

🎯 ¿Conocías este gran clásico de la literatura rusa? Déjame tu opinión en los comentarios 👇

📖 Si te gusta la literatura rusa, suscríbete al canal:
${channelData.handle}

🔔 Activa la campanita para no perderte ningún video

📱 Sígueme en redes:
Instagram: @ClasicosEnCorto
Twitter: @ClasicosEnCorto

📚 Más videos de literatura rusa:
${channelData.hashtags}

---
📖 Información del libro:
📝 Título: ${classic.title}
👤 Autor: ${classic.author}
📅 Año: ${classic.year}
🎭 Género: ${classic.mood}

🎵 Música recomendada: ${classic.recommendedMusic}

---
Este video es para fines educativos. Todos los derechos reservados a sus respectivos autores.

#literaturarusa #${classic.id.replace(/-/g, '')} #clasicos #libros #educacion #cultura`;
  };

  // Генерация тегов для YouTube
  const generateVideoTags = () => {
    const baseTags = [
      "literatura rusa",
      "clasicos literarios",
      "resumen de libros",
      "analisis literario",
      classic.author.toLowerCase().replace(/ /g, " "),
      classic.title.toLowerCase().replace(/ /g, " "),
      "libros rusos",
      "educacion",
      "cultura rusa",
      "historia de la literatura",
      "dostoyevski",
      "tolstoi",
      "bulgakov",
      "psicologia en literatura",
      "filosofia rusa",
      "clasicos universales",
      "literatura mundial",
      "recomendaciones de lectura",
      "libros que cambian tu vida"
    ];
    return baseTags.join(", ");
  };

  // Генерация текста для превью
  const generateThumbnailText = () => {
    const thumbnailTexts = [
      `¿POR QUÉ ES UN CLÁSICO?`,
      `EL SECRETO DE ${classic.author.toUpperCase().split(" ")[1]}`,
      `ESTE LIBRO CAMBIA TU VIDA`,
      `LO QUE NADIE TE DICE`,
      `5 MINUTOS PARA ENTENDER`,
      `LA VERDAD OCULTA`
    ];
    return thumbnailTexts[Math.floor(Math.random() * thumbnailTexts.length)];
  };

  const handleCopy = (text, setter) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const videoTitle = generateVideoTitle();
  const videoDescription = generateVideoDescription();
  const videoTags = generateVideoTags();
  const thumbnailText = generateThumbnailText();

  return (
    <div className="youtube-metadata-container card-premium">
      <h3 className="section-title">
        <span className="sparkle">🎬</span> Generador de Metadatos YouTube
      </h3>

      <div className="metadata-grid">
        {/* Título del Video */}
        <div className="metadata-section">
          <h4>📝 Título del Video</h4>
          <div className="metadata-box">
            <p className="metadata-text">{videoTitle}</p>
            <button 
              className={`copy-btn ${copiedTitle ? "copied" : ""}`}
              onClick={() => handleCopy(videoTitle, setCopiedTitle)}
            >
              {copiedTitle ? "¡Copiado! ✓" : "Copiar Título"}
            </button>
          </div>
          <button 
            className="secondary-btn"
            onClick={() => window.location.reload()}
          >
            🔄 Generar otro título
          </button>
        </div>

        {/* Descripción del Video */}
        <div className="metadata-section">
          <h4>📄 Descripción del Video</h4>
          <div className="metadata-box large">
            <pre className="metadata-text pre">{videoDescription}</pre>
            <button 
              className={`copy-btn ${copiedDescription ? "copied" : ""}`}
              onClick={() => handleCopy(videoDescription, setCopiedDescription)}
            >
              {copiedDescription ? "¡Copiada! ✓" : "Copiar Descripción"}
            </button>
          </div>
        </div>

        {/* Tags del Video */}
        <div className="metadata-section">
          <h4>🏷️ Tags del Video</h4>
          <div className="metadata-box">
            <p className="metadata-text">{videoTags}</p>
            <button 
              className={`copy-btn ${copiedTags ? "copied" : ""}`}
              onClick={() => handleCopy(videoTags, setCopiedTags)}
            >
              {copiedTags ? "¡Copiados! ✓" : "Copiar Tags"}
            </button>
          </div>
        </div>

        {/* Texto para Thumbnail */}
        <div className="metadata-section">
          <h4>🖼️ Texto para Thumbnail</h4>
          <div className="metadata-box">
            <p className="metadata-text large">{thumbnailText}</p>
            <button 
              className={`copy-btn ${copiedThumbnail ? "copied" : ""}`}
              onClick={() => handleCopy(thumbnailText, setCopiedThumbnail)}
            >
              {copiedThumbnail ? "¡Copiado! ✓" : "Copiar Texto"}
            </button>
          </div>
          <button 
            className="secondary-btn"
            onClick={() => window.location.reload()}
          >
            🔄 Generar otro texto
          </button>
        </div>

        {/* Información del Canal */}
        <div className="metadata-section full-width">
          <h4>📺 Información del Canal</h4>
          <div className="channel-info">
            <div className="channel-stats">
              <div className="stat-item">
                <span className="stat-label">Nombre del canal:</span>
                <span className="stat-val">{channelData.name}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Handle:</span>
                <span className="stat-val">{channelData.handle}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Categoría:</span>
                <span className="stat-val">{channelData.category}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Mejor día para publicar:</span>
                <span className="stat-val">{channelData.schedule.bestDays.join(", ")}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Mejor hora:</span>
                <span className="stat-val">{channelData.schedule.bestTime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
