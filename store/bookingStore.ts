import { create } from 'zustand';

interface Booking {
  booking_id: string;
  client_id: string;
  service_id: string;
  provider_id?: string;
  date: string;
  time: string;
  address: string;
  notes?: string;
  status: string;
  total_price: number;
  payment_status: string;
}

interface Task {
  task_id: string;
  booking_id?: string;
  provider_id: string;
  title: string;
  description: string;
  status: string;
  due_date?: string;
  notes?: string;
}

interface BookingStore {
  bookings: Booking[];
  tasks: Task[];
  setBookings: (bookings: Booking[]) => void;
  setTasks: (tasks: Task[]) => void;
  addBooking: (booking: Booking) => void;
  updateBooking: (bookingId: string, updates: Partial<Booking>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  bookings: [],
  tasks: [],
  
  setBookings: (bookings) => set({ bookings }),
  setTasks: (tasks) => set({ tasks }),
  
  addBooking: (booking) => set((state) => ({ bookings: [booking, ...state.bookings] })),
  
  updateBooking: (bookingId, updates) => set((state) => ({
    bookings: state.bookings.map(b => 
      b.booking_id === bookingId ? { ...b, ...updates } : b
    )
  })),
  
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map(t => 
      t.task_id === taskId ? { ...t, ...updates } : t
    )
  })),
}));
