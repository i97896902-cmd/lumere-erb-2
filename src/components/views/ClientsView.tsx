import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Project, Task } from '../../types';
import { DataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { canManageClients as checkCanManageClients } from '../../utils/rbac';
import {
  Building,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Edit2,
  Trash2,
  FolderKanban,
  CheckCircle2,
  Clock,
  X,
  User,
  Globe,
  FileText,
  ChevronLeft,
} from 'lucide-react';

interface ClientsViewProps {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  onRefresh?: () => void;
  onSelectProject?: (projectId: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  projects,
  tasks,
  onRefresh,
}) => {
  const { currentUser } = useAuth();
  const { activeCompany, isGroupView, subsidiaries, defaultWriteCompanyId, getCompanyById } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Form State
  const [formCompanyId, setFormCompanyId] = useState(defaultWriteCompanyId);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formType, setFormType] = useState<Client['clientType']>('corporate');
  const [formStatus, setFormStatus] = useState<Client['status']>('active');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canManageClients = checkCanManageClients(currentUser, defaultWriteCompanyId);

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(term) ||
      (c.company && c.company.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.clientType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const openAddModal = () => {
    setEditingClient(null);
    setFormCompanyId(defaultWriteCompanyId);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormCompany('');
    setFormAddress('');
    setFormType('corporate');
    setFormStatus('active');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormCompanyId(client.companyId || defaultWriteCompanyId);
    setFormName(client.name);
    setFormEmail(client.email || '');
    setFormPhone(client.phone || '');
    setFormCompany(client.company || '');
    setFormAddress(client.address || '');
    setFormType(client.clientType || 'corporate');
    setFormStatus(client.status || 'active');
    setFormNotes(client.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !currentUser) return;

    setIsSaving(true);
    try {
      if (editingClient) {
        await DataService.updateClient(
          editingClient.id,
          {
            name: formName.trim(),
            email: formEmail.trim(),
            phone: formPhone.trim(),
            company: formCompany.trim(),
            address: formAddress.trim(),
            clientType: formType,
            status: formStatus,
            notes: formNotes.trim(),
          },
          currentUser
        );
      } else {
        await DataService.createClient(
          {
            companyId: formCompanyId,
            name: formName.trim(),
            email: formEmail.trim(),
            phone: formPhone.trim(),
            company: formCompany.trim(),
            address: formAddress.trim(),
            clientType: formType,
            status: formStatus,
            notes: formNotes.trim(),
            projectsCount: 0,
            activeTasksCount: 0,
          },
          currentUser
        );
      }
      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error saving client:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClient = async (client: Client) => {
    if (!currentUser || !canManageClients) return;
    if (confirmDeleteId !== client.id) {
      setConfirmDeleteId(client.id);
      return;
    }

    setIsDeletingId(client.id);
    try {
      await DataService.deleteClient(client.id, currentUser, client.companyId);
      setConfirmDeleteId(null);
      if (selectedClientForDetails?.id === client.id) {
        setSelectedClientForDetails(null);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error deleting client:', err);
    } finally {
      setIsDeletingId(null);
    }
  };

  const getClientTypeLabel = (type?: string) => {
    switch (type) {
      case 'corporate':
        return 'شركات ومؤسسات';
      case 'individual':
        return 'أفراد ونخبة';
      case 'government':
        return 'جهات حكومية';
      case 'enterprise':
        return 'مشاريع كبرى';
      default:
        return 'عميل تجاري';
    }
  };

  return (
    <div id="clients-view" className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                إدارة العملاء والشركاء — {activeCompany.name}
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                سجل العملاء والمؤسسات وربطهم بالمشاريع والمهام التنفيذية داخل الشركة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-xs text-neutral-600">
            <span>إجمالي العملاء:</span>
            <strong className="text-neutral-900 font-semibold">{clients.length}</strong>
          </div>

          {canManageClients && (
            <button
              id="btn-add-client"
              onClick={openAddModal}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عميل جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-search-clients"
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث باسم العميل، المؤسسة، البريد، أو رقم الهاتف..."
            className="w-full pr-10 pl-4 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 sm:pb-0">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">نشط فقط</option>
            <option value="inactive">غير نشط</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">كافة الفئات</option>
            <option value="corporate">شركات ومؤسسات</option>
            <option value="individual">أفراد ونخبة</option>
            <option value="government">جهات حكومية</option>
            <option value="enterprise">مشاريع كبرى</option>
          </select>
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center">
          <Building className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-neutral-900 mb-1">لم يتم العثور على عملاء مطابقين</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchTerm ? 'جرب البحث بكلمات مختلفة أو قم بإزالة عوامل التصفية.' : 'ابدأ بإضافة أول عميل إلى منظومة Luméré.'}
          </p>
          {canManageClients && !searchTerm && (
            <button
              onClick={openAddModal}
              className="mt-4 py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة عميل الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);
            const clientTasks = tasks.filter(t => t.clientId === client.id);

            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs hover:border-emerald-500/40 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-sm">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-900 line-clamp-1">{client.name}</h3>
                        {client.company && (
                          <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3 text-neutral-400" />
                            <span className="line-clamp-1">{client.company}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        client.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {client.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </div>

                  <div className="mb-3.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                      {getClientTypeLabel(client.clientType)}
                    </span>
                    {isGroupView && client.companyId && (
                      <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-md">
                        {getCompanyById(client.companyId)?.name || client.companyId}
                      </span>
                    )}
                  </div>

                  {/* Contacts */}
                  <div className="space-y-1.5 text-xs text-neutral-600 border-t border-neutral-100 pt-3 mb-4">
                    {client.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate font-mono dir-ltr">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="font-mono">{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-2 text-neutral-500">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Counter */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 mb-4 text-center">
                    <div>
                      <span className="block text-[11px] text-neutral-500">المشاريع</span>
                      <strong className="text-xs font-bold text-neutral-900">
                        {clientProjects.length}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[11px] text-neutral-500">المهام المرتبطة</span>
                      <strong className="text-xs font-bold text-emerald-800">
                        {clientTasks.length}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                  <button
                    onClick={() => setSelectedClientForDetails(client)}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <span>تفاصيل العميل والمشاريع</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {canManageClients && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        title="تعديل العميل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteId === client.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteClient(client)}
                            disabled={isDeletingId === client.id}
                            className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
                          >
                            تأكيد الحذف
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg bg-neutral-100 text-neutral-600 text-[11px] font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteClient(client)}
                          disabled={isDeletingId === client.id}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="حذف العميل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-5">
                <div className="flex items-center gap-2 text-emerald-800">
                  <Building className="w-5 h-5" />
                  <h3 className="font-bold text-base text-neutral-900">
                    {editingClient ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
                {isGroupView && !editingClient && (
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      الشركة التابعة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCompanyId}
                      onChange={e => setFormCompanyId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      {subsidiaries.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.arabicName ? `— ${c.arabicName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    اسم العميل / جهة الاتصال الرئيسية <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="مثال: عبد العزيز الراجحي"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">اسم المؤسسة / الشركة</label>
                    <input
                      type="text"
                      value={formCompany}
                      onChange={e => setFormCompany(e.target.value)}
                      placeholder="مثال: مجموعة الراجحي القابضة"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">فئة وتصنيف العميل</label>
                    <select
                      value={formType}
                      onChange={e => setFormType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="corporate">شركات ومؤسسات (Corporate)</option>
                      <option value="enterprise">مشاريع كبرى (Enterprise)</option>
                      <option value="government">جهات حكومية (Government)</option>
                      <option value="individual">أفراد ونخبة (Individual)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      placeholder="client@company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500 dir-ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">رقم الهاتف / الجوال</label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={e => setFormPhone(e.target.value)}
                      placeholder="+966 50 123 4567"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500 dir-ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">المدينة / المقر</label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={e => setFormAddress(e.target.value)}
                      placeholder="مثال: الرياض - العليا"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">حالة العميل</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="active">نشط (Active)</option>
                      <option value="inactive">غير نشط (Inactive)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">ملاحظات إضافية أو نطاق التعاون</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="ملاحظات حول متطلبات العميل، مواعيد التسليم، أو التفضيلات الخاصة..."
                    className="w-full p-3 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? 'جارِ الحفظ...' : editingClient ? 'حفظ التعديلات' : 'إضافة العميل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                    className="py-2.5 px-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Details Slideover / Modal */}
      <AnimatePresence>
        {selectedClientForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-xl w-full p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between pb-4 border-b border-neutral-100 mb-4">
                <div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    ملف العميل
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900 mt-1">{selectedClientForDetails.name}</h3>
                  {selectedClientForDetails.company && (
                    <p className="text-xs text-neutral-500">{selectedClientForDetails.company}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedClientForDetails(null)}
                  className="text-neutral-400 hover:text-neutral-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Linked Projects for this Client */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-neutral-800 mb-2 flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-emerald-600" />
                  <span>المشاريع المسندة لهذا العميل ({projects.filter(p => p.clientId === selectedClientForDetails.id).length})</span>
                </h4>

                <div className="space-y-2">
                  {projects.filter(p => p.clientId === selectedClientForDetails.id).length === 0 ? (
                    <p className="text-xs text-neutral-400 p-3 bg-neutral-50 rounded-xl">لا توجد مشاريع مسندة لهذا العميل حالياً.</p>
                  ) : (
                    projects
                      .filter(p => p.clientId === selectedClientForDetails.id)
                      .map(p => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between text-xs"
                        >
                          <div>
                            <strong className="block text-neutral-900">{p.name}</strong>
                            <span className="text-[11px] text-neutral-500">{p.department}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 font-medium">
                            {p.status === 'completed' ? 'مكتمل' : p.status === 'in_progress' ? 'قيد التنفيذ' : 'تخطيط'}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Linked Tasks for this Client */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-neutral-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>المهام المرتبطة بالعميل ({tasks.filter(t => t.clientId === selectedClientForDetails.id).length})</span>
                </h4>

                <div className="space-y-2">
                  {tasks.filter(t => t.clientId === selectedClientForDetails.id).length === 0 ? (
                    <p className="text-xs text-neutral-400 p-3 bg-neutral-50 rounded-xl">لا توجد مهام نشطة مرتبطة بهذا العميل حالياً.</p>
                  ) : (
                    tasks
                      .filter(t => t.clientId === selectedClientForDetails.id)
                      .slice(0, 5)
                      .map(t => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-neutral-800 truncate max-w-[280px]">{t.title}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">{t.status}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex justify-end">
                <button
                  onClick={() => setSelectedClientForDetails(null)}
                  className="py-2 px-4 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
