import ModernMinimalTemplate from './Templates/ModernMinimalTemplate';
import FullWidthTemplate from './Templates/FullWidthTemplate';
import HeroFocusTemplate from './Templates/HeroFocusTemplate';
import GalleryTemplate from './Templates/GalleryTemplate';
import LuxuryPremiumTemplate from './Templates/LuxuryPremiumTemplate';

const TEMPLATES = {
  modern_minimal: ModernMinimalTemplate,
  full_width: FullWidthTemplate,
  hero_focus: HeroFocusTemplate,
  gallery_style: GalleryTemplate,
  luxury_premium: LuxuryPremiumTemplate,
};

export default function TemplateRenderer({
  templateId = 'modern_minimal',
  business,
  branding = {},
  sections = {},
  sectionOrder = [],
  children
}) {
  const Template = TEMPLATES[templateId] || TEMPLATES.modern_minimal;

  // Set default branding values if not provided
  const defaultBranding = {
    primary_color: '#1a5490',
    secondary_color: '#2c5aa0',
    font_family: 'inter',
    dark_mode: false,
    logo_position: 'left',
    ...branding
  };

  // Ensure sectionOrder is provided
  const order = sectionOrder.length > 0 ? sectionOrder : Object.keys(sections).filter(k => k !== 'section_order');

  return (
    <Template
      business={business}
      branding={defaultBranding}
      sections={sections}
      sectionOrder={order}
    >
      {children}
    </Template>
  );
}
