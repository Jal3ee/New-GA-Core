import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar as CalendarIcon, List, BarChart2, Filter } from 'lucide-react';
import { api } from '../lib/gasClient';
import { useGlobalLoading } from '../context/LoadingContext';
import { toast } from 'sonner';
import { subMonths, addMonths } from 'date-fns';
import CustomSelect from '../components/ui/CustomSelect';

// Components
import EventCalendarView from '../features/calendar/components/EventCalendarView';
import EventListView from '../features/calendar/components/EventListView';
import EventGanttView from '../features/calendar/components/EventGanttView';
import EventFormModal from '../features/calendar/components/EventFormModal';
import EventDetailDrawer from '../features/calendar/components/EventDetailDrawer';
import { expandEvents } from '../features/calendar/utils/eventUtils';

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'gantt', 'list'
  
  // Filters
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [activeEmployees, setActiveEmployees] = useState([]); // Store employees for PIC selection
  
  // Modals / Drawers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null); // for editing/drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Dates for expansion
  const [currentDate, setCurrentDate] = useState(new Date());

  const { showLoading, hideLoading } = useGlobalLoading();

  const loadEvents = async () => {
    try {
      showLoading('Memuat Jadwal...');
      
      // Load sequentially to prevent GAS Concurrent Lock
      const eventsRes = await api.getEvents();
      const usersRes = await api.getUsers();
      
      let combinedEvents = [];
      if (eventsRes.ok) combinedEvents = eventsRes.data || [];
      
      if (usersRes.ok) {
        const users = usersRes.data || [];
        
        // Extract active employees for PIC tagging
        const employees = users.filter(u => u.role === 'Karyawan' && u.status === 'Active');
        setActiveEmployees(employees);

        users.forEach(u => {
          if (u.birthdate) {
            combinedEvents.push({
              id: `birthday-${u.id}`,
              title: `🎉 Ultah ${u.name}`,
              category: 'Birthday',
              start_time: u.birthdate,
              end_time: u.birthdate,
              status: 'Open',
              recurrence_rule: 'FREQ=YEARLY',
              isBirthday: true,
              notes: `Selamat ulang tahun, ${u.name}!`
            });
          }
        });
      }
      setEvents(combinedEvents);
    } catch (err) {
      console.error('Error in loadEvents:', err);
      toast.error('Gagal memuat jadwal kegiatan');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveEvent = async (payload, id) => {
    setIsFormOpen(false);
    showLoading(id ? 'Menyimpan Perubahan...' : 'Menambahkan Kegiatan...');
    try {
      if (id) {
        await api.updateEvent(id, payload);
        toast.success('Kegiatan berhasil diperbarui');
      } else {
        await api.createEvent(payload);
        toast.success('Kegiatan baru berhasil ditambahkan');
      }
      loadEvents();
    } catch (err) {
      toast.error('Terjadi kesalahan saat menyimpan');
    } finally {
      hideLoading();
    }
  };

  const handleDeleteEvent = async (id) => {
    showLoading('Menghapus...');
    try {
      await api.deleteEvent(id);
      toast.success('Kegiatan berhasil dihapus');
      loadEvents();
    } catch (err) {
      toast.error('Gagal menghapus kegiatan');
    } finally {
      hideLoading();
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    showLoading('Mengubah Status...');
    try {
      await api.updateEvent(id, { status: newStatus });
      toast.success(`Status diubah menjadi ${newStatus}`);
      
      // Update local state for fast UI refresh
      setEvents(events.map(e => e.id === id ? { ...e, status: newStatus } : e));
      if (selectedEvent && selectedEvent.id === id) {
        setSelectedEvent({ ...selectedEvent, status: newStatus });
      }
    } catch (err) {
      toast.error('Gagal merubah status');
    } finally {
      hideLoading();
    }
  };

  const handleUpdateChecklist = async (id, newChecklistJson) => {
    try {
      await api.updateEvent(id, { checklist_json: newChecklistJson });
      // Update local implicitly via loadEvents in background or direct state
      setEvents(events.map(e => e.id === id ? { ...e, checklist_json: newChecklistJson } : e));
    } catch (err) {
      throw err; // Caught by drawer
    }
  };

  // 1. Filter raw events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchCat = filterCategory === 'All' || e.category === filterCategory;
      const matchStat = filterStatus === 'All' || e.status === filterStatus;
      return matchCat && matchStat;
    });
  }, [events, filterCategory, filterStatus]);

  // 2. Expand recurring events for UI (expand window: -3 months to +12 months)
  const expandedEventsForUI = useMemo(() => {
    const startWindow = subMonths(new Date(), 3);
    const endWindow = addMonths(new Date(), 12);
    return expandEvents(filteredEvents, startWindow, endWindow);
  }, [filteredEvents]);

  return (
    <div className="space-y-6 flex flex-col min-h-full">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)]">Calendar of Event</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Kelola jadwal kegiatan operasional</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Filters */}
          <div className="flex items-center">
            <CustomSelect 
              value={filterCategory} 
              onChange={setFilterCategory}
              className="w-40 z-20"
              options={[
                { value: 'All', label: 'Semua Kategori' },
                { value: 'Meeting', label: 'Meeting' },
                { value: 'Maintenance', label: 'Maintenance' },
                { value: 'Audit', label: 'Audit' },
                { value: 'Visit', label: 'Kunjungan' },
                { value: 'Other', label: 'Lain-lain' }
              ]}
            />
          </div>

          <div className="flex items-center">
            <CustomSelect 
              value={filterStatus} 
              onChange={setFilterStatus}
              className="w-40 z-20"
              options={[
                { value: 'All', label: 'Semua Status' },
                { value: 'Open', label: 'Open' },
                { value: 'Closed', label: 'Closed' }
              ]}
            />
          </div>

          {/* View Toggles */}
          <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-md)] p-1 shadow-sm">
            <button 
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'calendar' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              title="Calendar View"
            ><CalendarIcon className="w-4 h-4"/></button>
            <button 
              onClick={() => setViewMode('gantt')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'gantt' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              title="Gantt View"
            ><BarChart2 className="w-4 h-4 rotate-90"/></button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              title="List View"
            ><List className="w-4 h-4"/></button>
          </div>

          <button 
            onClick={() => { setSelectedEvent(null); setIsFormOpen(true); }}
            className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-[var(--radius-md)] transition-colors shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-[700px]">
        {viewMode === 'calendar' && (
          <EventCalendarView 
            events={expandedEventsForUI} 
            onEventClick={(ev) => { setSelectedEvent(ev); setIsDrawerOpen(true); }}
            onDateClick={(date) => { /* Optional: Open form prepopulated with date */ }}
          />
        )}
        
        {viewMode === 'list' && (
          <EventListView 
            events={expandedEventsForUI}
            onEventClick={(ev) => { setSelectedEvent(ev); setIsDrawerOpen(true); }}
          />
        )}

        {viewMode === 'gantt' && (
          <EventGanttView 
            events={expandedEventsForUI}
            currentDate={currentDate}
            onEventClick={(ev) => { setSelectedEvent(ev); setIsDrawerOpen(true); }}
          />
        )}
      </div>

      {/* Modals */}
      <EventFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        initialData={selectedEvent}
        onSave={handleSaveEvent}
        activeEmployees={activeEmployees}
      />

      <EventDetailDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        eventData={selectedEvent}
        onEdit={(ev) => { setIsDrawerOpen(false); setSelectedEvent(ev); setIsFormOpen(true); }}
        onDelete={handleDeleteEvent}
        onUpdateStatus={handleUpdateStatus}
        onUpdateChecklist={handleUpdateChecklist}
      />
    </div>
  );
}
