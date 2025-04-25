import { create } from 'zustand';

// 모달 타입 정의 - 앱에서 사용하는 모든 모달의 이름을 여기에 추가
export type ModalName = 
  | 'myInfoModal'     // 내 정보 모달
  | 'minSearchModal'  // 검색 모달
  | 'none';           // 열린 모달 없음

interface ModalState {
  // 모달 열림 상태
  isModal: boolean;
  // 현재 열린 모달의 이름
  modalName: ModalName;
}

interface ModalActions {
  // 특정 모달 열기
  openModal: (modalName: ModalName) => void;
  // 현재 열린 모달 닫기
  closeModal: () => void;
  // 모달 이름 설정하기
  setModalName: (modalName: ModalName) => void;
}

// 모달 상태 관리 스토어
const useModalStore = create<ModalState & ModalActions>((set) => ({
  // 초기 상태
  isModal: false,
  modalName: 'none',

  // 특정 모달 열기
  openModal: (modalName) => set({ isModal: true, modalName }),
  
  // 현재 열린 모달 닫기
  closeModal: () => set({ isModal: false, modalName: 'none' }),
  
  // 모달 이름 설정하기
  setModalName: (modalName) => set({ modalName }),
}));

// 쉬운 사용을 위한 훅 분리
export const useModalState = () => {
  const isModal = useModalStore((state) => state.isModal);
  const modalName = useModalStore((state) => state.modalName);
  
  return { isModal, modalName };
};

export const useModalActions = () => {
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const setModalName = useModalStore((state) => state.setModalName);
  
  return { openModal, closeModal, setModalName };
};

export default useModalStore;