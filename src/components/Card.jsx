import React from "react";
import "./Card.css";

const Card = ({ imageSrc, title, description, id = "", accent = "amber" }) => {
  return (
    <article className={`filter-card accent-${accent}`}>
      <div className="filter-card-media">
        <img id={id} src={imageSrc} alt={title} className="filter-card-image" />
      </div>
      <div className="filter-card-copy">
        <span className="filter-card-tag">Look</span>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
    </article>
  );
};

export default Card;
