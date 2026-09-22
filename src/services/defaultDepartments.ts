import { Department } from '../types';

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'dept-dev',
    name: 'هندسة البرمجيات والتطوير',
    description: 'تطوير المنصات الرقمية، البنية التحتية السحابية، وأمن المعلومات.',
    color: '#059669', // Emerald
    createdAt: new Date().toISOString(),
  },
  {
    id: 'dept-design',
    name: 'التصميم وتجربة المستخدم',
    description: 'واجهات وتجربة المستخدم، الهوية البصرية، وتصميم المنتجات.',
    color: '#D97706', // Gold / Amber
    createdAt: new Date().toISOString(),
  },
  {
    id: 'dept-marketing',
    name: 'التسويق ونمو الأعمال',
    description: 'إدارة الحملات التسويقية، استراتيجيات المحتوى، والعلاقات العامة.',
    color: '#2563EB', // Blue
    createdAt: new Date().toISOString(),
  },
  {
    id: 'dept-media',
    name: 'الإنتاج الإعلامي والمرئي',
    description: 'صناعة المحتوى المرئي، الإنتاج الصوتي، والمونتاج الرقمي.',
    color: '#7C3AED', // Violet
    createdAt: new Date().toISOString(),
  },
  {
    id: 'dept-sales',
    name: 'المبيعات وتطوير الأعمال',
    description: 'إدارة علاقات العملاء، الشراكات التجارية، وإبرام العقود.',
    color: '#0D9488', // Teal
    createdAt: new Date().toISOString(),
  },
  {
    id: 'dept-mgmt',
    name: 'الإدارة العامة والتشغيل',
    description: 'التخطيط الاستراتيجي، متابعة العمليات، وضبط الجودة الشاملة.',
    color: '#475569', // Slate
    createdAt: new Date().toISOString(),
  },
];
