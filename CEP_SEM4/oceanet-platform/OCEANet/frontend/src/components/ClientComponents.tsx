'use client'

import dynamic from 'next/dynamic'

const ToastContainer = dynamic(() => import('@/components/ToastContainer'), {
  ssr: false,
  loading: () => null,
})

const FloatingAIAssistant = dynamic(() => import('@/components/FloatingAIAssistant'), {
  ssr: false,
  loading: () => null,
})

export default function ClientComponents() {
  return (
    <>
      <ToastContainer />
      <FloatingAIAssistant />
    </>
  )
}
