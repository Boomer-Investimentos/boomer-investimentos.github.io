import styles from './LocationMap.module.css';

function LocationMap() {
  return (
    <div className={styles.mapContainer}>
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3679.123456789012!2d-43.93456789012345!3d-19.919876543210987!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0:0x123456789abcdef0!2sRua%20da%20Bahia%2C%20905%2C%20Belo%20Horizonte%20-%20MG%2C%2030015-000!5e0!3m2!1spt-BR!2sbr!4v1612345678901'"
        className={styles.mapIframe}
        allowFullScreen=""
        loading="lazy"
        title="Localização do Escritório"
      ></iframe>
    </div>
  );
}

export default LocationMap;