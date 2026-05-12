import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/App.css';
import '../../styles/legal.css';

interface LegalPageLayoutProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAt: string;
  readonly children: React.ReactNode;
}

const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  eyebrow,
  title,
  subtitle,
  updatedAt,
  children,
}) => {
  const navigate = useNavigate();
  const handleBack = () => {
	if (window.history.length > 1) {
	  navigate(-1);
	  return;
	}

	navigate('/');
  };

  return (
	<div className="legal-page">
	  <div className="legal-page__bg" aria-hidden="true" />
	  <div className="legal-page__container">
		<div className="legal-page__topbar">
		  <button
			type="button"
			className="legal-page__back"
			onClick={handleBack}
			aria-label="Revenir à la page précédente"
		  >
			← Retour
		  </button>
		</div>

		<article className="legal-card">
		  <header className="legal-card__header">
			<span className="legal-card__eyebrow">{eyebrow}</span>
			<h1 className="legal-card__title">{title}</h1>
			<p className="legal-card__subtitle">{subtitle}</p>
			<div className="legal-card__meta">
			  <span>Dernière mise à jour : {updatedAt}</span>
			  <span>Version mobile-first</span>
			</div>
		  </header>

		  <div className="legal-card__content">{children}</div>
		</article>
	  </div>
	</div>
  );
};

export default LegalPageLayout;




