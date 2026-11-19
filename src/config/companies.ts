import { Company } from '../types';

export const PARENT_COMPANY_ID = 'lumere-group';
export const DEFAULT_SUBSIDIARY_ID = 'lumere';
export const NEX_AURA_COMPANY_ID = 'nex-aura';
export const ORDARK_COMPANY_ID = 'ordark';

export interface SuggestedDepartmentSeed {
  id: string;
  name: string;
  description: string;
  color: string;
}

export const CORE_COMPANIES: Company[] = [
  {
    id: PARENT_COMPANY_ID,
    name: 'LUMERE GROUP',
    arabicName: 'مجموعة لومير القابضة',
    slug: 'lumere-group',
    type: 'parent',
    parentCompanyId: null,
    logo: '',
    description: 'الإدارة المركزية لمجموعة لومير القابضة والإشراف التنفيذي على كافة الشركات التابعة.',
    businessSector: 'الإدارة المركزية والقابضة',
    status: 'active',
    theme: {
      primary: '#059669',
      accent: '#047857',
      surface: '#ecfdf5',
      badgeText: '#065f46',
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: DEFAULT_SUBSIDIARY_ID,
    name: 'LUMERE',
    arabicName: 'لومير للإعلام والتسويق',
    slug: 'lumere',
    type: 'subsidiary',
    parentCompanyId: PARENT_COMPANY_ID,
    logo: '',
    description: 'شركة متخصصة في الإعلام، التسويق الإبداعي، الإعلان، والإنتاج المرئي.',
    businessSector: 'الإعلام والتسويق والإعلان',
    status: 'active',
    theme: {
      primary: '#059669',
      accent: '#0d9488',
      surface: '#ecfdf5',
      badgeText: '#065f46',
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: NEX_AURA_COMPANY_ID,
    name: 'NEX AURA',
    arabicName: 'نيكس أورا للتقنية والبرمجيات',
    slug: 'nex-aura',
    type: 'subsidiary',
    parentCompanyId: PARENT_COMPANY_ID,
    logo: '',
    description: 'شركة تطوير البرمجيات والحلول التقنية وتصميم الأنظمة الرقمية.',
    businessSector: 'تطوير البرمجيات والتقنية',
    status: 'active',
    theme: {
      primary: '#2563eb',
      accent: '#1d4ed8',
      surface: '#eff6ff',
      badgeText: '#1e40af',
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: ORDARK_COMPANY_ID,
    name: 'ORDARK',
    arabicName: 'أوردارك للتوصيل واللوجستيات',
    slug: 'ordark',
    type: 'subsidiary',
    parentCompanyId: PARENT_COMPANY_ID,
    logo: '',
    description: 'شركة التوصيل والخدمات اللوجستية وإدارة الأسطول والتوزيع.',
    businessSector: 'التوصيل واللوجستيات',
    status: 'active',
    theme: {
      primary: '#d97706',
      accent: '#b45309',
      surface: '#fffbeb',
      badgeText: '#92400e',
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

export const SUGGESTED_DEPARTMENTS_BY_COMPANY: Record<string, SuggestedDepartmentSeed[]> = {
  [DEFAULT_SUBSIDIARY_ID]: [
    {
      id: 'lumere-marketing',
      name: 'التسويق',
      description: 'إدارة الحملات التسويقية والاستراتيجيات الرقمية وتطوير العلامة التجارية.',
      color: 'bg-amber-600',
    },
    {
      id: 'lumere-media-production',
      name: 'الإنتاج الإعلامي',
      description: 'الإنتاج المرئي، المونتاج، وإخراج المحتوى الإعلاني والسينمائي.',
      color: 'bg-rose-600',
    },
    {
      id: 'lumere-photography',
      name: 'التصوير الفوتوغرافي',
      description: 'جلسات التصوير الاحترافي للمنتجات والفعاليات والهويات التجارية.',
      color: 'bg-emerald-600',
    },
    {
      id: 'lumere-graphic-design',
      name: 'التصميم الجرافيكي',
      description: 'تصميم الهويات البصرية والمطبوعات والمحتوى الإبداعي لمنصات التواصل.',
      color: 'bg-teal-600',
    },
  ],
  [NEX_AURA_COMPANY_ID]: [
    {
      id: 'nex-aura-software-dev',
      name: 'تطوير البرمجيات',
      description: 'هندسة الحلول البرمجية وإدارة معمارية الأنظمة المؤسسية.',
      color: 'bg-blue-700',
    },
    {
      id: 'nex-aura-frontend',
      name: 'تطوير الواجهات الأمامية',
      description: 'تطوير تطبيقات الويب التفاعلية وتجارب المستخدم الحديثة.',
      color: 'bg-sky-600',
    },
    {
      id: 'nex-aura-backend',
      name: 'تطوير الأنظمة الخلفية',
      description: 'بناء واجهات البرمجة وقواعد البيانات والبنية السحابية.',
      color: 'bg-indigo-600',
    },
    {
      id: 'nex-aura-ui-ux',
      name: 'تصميم تجربة وواجهة المستخدم UI/UX',
      description: 'البحث التفاعلي وتصميم نماذج المنتجات الرقمية وتجربة المستخدم.',
      color: 'bg-cyan-600',
    },
    {
      id: 'nex-aura-qa',
      name: 'ضمان الجودة QA',
      description: 'اختبار البرمجيات والتحقق من الموثوقية والأداء قبل الإطلاق.',
      color: 'bg-slate-700',
    },
  ],
  [ORDARK_COMPANY_ID]: [
    {
      id: 'ordark-operations',
      name: 'العمليات اللوجستية',
      description: 'تخطيط العمليات اليومية وإدارة سلاسل الإمداد ومؤشرات التوصيل.',
      color: 'bg-amber-700',
    },
    {
      id: 'ordark-dispatch',
      name: 'التوجيه والمتابعة',
      description: 'توزيع الطلبات وجدولة المسارات ومتابعة الأسطول لحظياً.',
      color: 'bg-orange-600',
    },
    {
      id: 'ordark-drivers',
      name: 'السائقون والتوصيل',
      description: 'إدارة فريق السائقين الميداني وتنفيذ عمليات التسليم للعملاء.',
      color: 'bg-yellow-700',
    },
    {
      id: 'ordark-customer-support',
      name: 'خدمة العملاء',
      description: 'دعم العملاء والرد على استفسارات الشحنات ومعالجة البلاغات.',
      color: 'bg-stone-700',
    },
  ],
};

export function createCompanySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `company-${Date.now()}`;
}

export function getCompanyDisplayName(company?: Pick<Company, 'name' | 'arabicName'> | null): string {
  if (!company) return 'LUMERE GROUP';
  return company.arabicName ? `${company.name} — ${company.arabicName}` : company.name;
}

export function getCompanyInitials(name?: string): string {
  if (!name) return 'LG';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
