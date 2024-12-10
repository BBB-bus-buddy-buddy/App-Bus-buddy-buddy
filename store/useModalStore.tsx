import { create } from 'zustand';

interface ModalState {
  isModal: boolean;
  modalName: string | null;
  
  // 액션
  setIsModal: (isOpen: boolean) => void;
  setModalName: (name: string | null) => void;
  openModal: (name: string) => void;
  closeModal: () => void;
}

const useModalStore = create<ModalState>()((set) => ({
  // 초기 상태
  isModal: false,
  modalName: null,

  // 액션
  setIsModal: (isOpen) => set({ isModal: isOpen }),
  setModalName: (name) => set({ modalName: name }),
  openModal: (name) => set({ isModal: true, modalName: name }),
  closeModal: () => set({ isModal: false, modalName: null }), // modalName을 null로 리셋
}));

// 선택자
export const useModalState = () => {
  const isModal = useModalStore((state) => state.isModal);
  const modalName = useModalStore((state) => state.modalName);
  return { isModal, modalName };
};

export const useModalActions = () => {
  const setIsModal = useModalStore((state) => state.setIsModal);
  const setModalName = useModalStore((state) => state.setModalName);
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  return { setIsModal, setModalName, openModal, closeModal };
};

export default useModalStore;