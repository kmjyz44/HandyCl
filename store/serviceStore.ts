import { create } from 'zustand';

interface Service {
  service_id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  image?: string;
  available: boolean;
}

interface ServiceStore {
  services: Service[];
  selectedCategory: string | null;
  setServices: (services: Service[]) => void;
  setSelectedCategory: (category: string | null) => void;
  getServiceById: (id: string) => Service | undefined;
}

export const useServiceStore = create<ServiceStore>((set, get) => ({
  services: [],
  selectedCategory: null,
  
  setServices: (services) => set({ services }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  
  getServiceById: (id) => {
    return get().services.find(s => s.service_id === id);
  },
}));
