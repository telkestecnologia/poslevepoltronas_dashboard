import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  ApiError,
  localLoginBypass,
  type AiKnowledge,
  type AiKnowledgeInput,
  type AiNotificationSettings,
  type AiUnansweredQuestion,
  type Branch,
  type BranchInput,
  type Chair,
  type ChairOption,
  type ChairQuery,
  type ChairStatus,
  type Courier,
  type CourierInput,
  type ManualBlock,
  type Municipality,
  type Order,
  type OrderSource,
  type OrderStatus,
  type RentalOverview,
  type RevenueOverview,
  type RevenuePeriod,
  type PreviewOrderInput,
  type Staff,
} from '../api'
import { CHAIR_PAGE_SIZE, type Modal, type Page } from '../types'
import { getMessage } from '../utils/errors'
import { loadPage, type PageData } from '../data/loadPage'

/** Owns authentication, page queries, mutations, and their loading states. */
export function useDashboard() {
  // Session and page data live here so switching pages keeps the current filters.
  const [credentials, setCredentials] = useState<string | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [chairs, setChairs] = useState<Chair[]>([])
  const [chairTotal, setChairTotal] = useState(0)
  const [chairPage, setChairPage] = useState(0)
  const [chairOptions, setChairOptions] = useState<ChairOption[]>([])
  const [activeChairCounts, setActiveChairCounts] = useState<Record<string, number>>({})
  const [branches, setBranches] = useState<Branch[]>([])
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [rentals, setRentals] = useState<RentalOverview | null>(null)
  const [rentalDate, setRentalDate] = useState(() =>
    new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' }))
  const [rentalLoading, setRentalLoading] = useState(false)
  const [rentalError, setRentalError] = useState('')
  const [revenue, setRevenue] = useState<RevenueOverview | null>(null)
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('MONTH')
  const [revenueLoading, setRevenueLoading] = useState(false)
  const [revenueError, setRevenueError] = useState('')
  const [aiKnowledge, setAiKnowledge] = useState<AiKnowledge[]>([])
  const [aiUnanswered, setAiUnanswered] = useState<AiUnansweredQuestion[]>([])
  const [aiNotificationSettings, setAiNotificationSettings] = useState<AiNotificationSettings | null>(null)
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [blocks, setBlocks] = useState<ManualBlock[]>([])
  const [page, setPage] = useState<Page>('overview')
  const [modal, setModal] = useState<Modal>(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [pageLoading, setPageLoading] = useState(false)
  const [chairLoading, setChairLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [loadedPage, setLoadedPage] = useState<Page | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ChairStatus | 'ALL'>('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [orderSourceFilter, setOrderSourceFilter] = useState<OrderSource | 'ALL'>('ALL')
  const localLoginStarted = useRef(false)
  const rentalRequestId = useRef(0)
  const revenueRequestId = useRef(0)
  const chairRequest =
    page === 'chairs' ? `${chairPage}:${appliedSearch}:${statusFilter}:${branchFilter}` : ''
  const chairQuery: ChairQuery = {
    page: chairPage,
    size: CHAIR_PAGE_SIZE,
    search: appliedSearch,
    status: statusFilter,
    branchId: branchFilter,
  }

  // Apply the response for the active page without clearing data from other pages.
  const applyPageData = useCallback((data: PageData | null) => {
    if (!data) return
    if (data.page === 'overview') {
      setRentals(data.rentals)
      setRevenue(data.revenue)
    } else if (data.page === 'chairs') {
      setBranches(data.branches)
      setChairs(data.chairs)
      setChairTotal(data.total)
      setChairOptions(data.options)
      setBlocks(data.blocks)
    } else if (data.page === 'branches') {
      setBranches(data.branches)
      setActiveChairCounts(data.activeCounts)
      setMunicipalities(data.municipalities)
    } else if (data.page === 'couriers') {
      setCouriers(data.couriers)
    } else if (data.page === 'orders') {
      setOrders(data.orders)
      setCouriers(data.couriers)
      setBranches(data.branches)
      setChairOptions(data.options)
    } else if (data.page === 'ai') {
      setAiKnowledge(data.knowledge)
      setAiUnanswered(data.unanswered)
    } else if (data.page === 'notifications') {
      setAiNotificationSettings(data.settings)
    }
    setLoadedPage(data.page)
  }, [])

  async function login(email: string, password: string) {
    setLoginBusy(true)
    setLoginError('')
    try {
      const bytes = new TextEncoder().encode(`${email}:${password}`)
      const auth = localLoginBypass
        ? ''
        : btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
      const identity = await api.me(auth)
      setPageLoading(true)
      setCredentials(auth)
      setStaff(identity)
    } catch (error) {
      setLoginError(getMessage(error))
    } finally {
      setLoginBusy(false)
    }
  }

  useEffect(() => {
    if (localLoginBypass && !localLoginStarted.current) {
      localLoginStarted.current = true
      void login('', '')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChairPage(0)
      setAppliedSearch(search.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  // A page visit loads its supporting data; the rental calendar requests only its chart.
  // Chair filters and pagination reload only the chair rows.
  useEffect(() => {
    if (credentials === null) {
      setChairLoading(false)
      return
    }
    let active = true
    if (page === 'chairs' && loadedPage === 'chairs' && !pageLoading) {
      setChairLoading(true)
      setPageError('')
      void api
        .chairs(credentials, chairQuery)
        .then((result) => {
          if (!active) return
          if (result.items.length === 0 && chairPage > 0) {
            setChairPage(Math.max(0, Math.ceil(result.total / CHAIR_PAGE_SIZE) - 1))
          } else {
            setChairs(result.items)
            setChairTotal(result.total)
          }
        })
        .catch((error) => {
          if (active) setPageError(getMessage(error))
        })
        .finally(() => {
          if (active) setChairLoading(false)
        })
      return () => {
        active = false
      }
    }
    setChairLoading(false)
    setPageLoading(true)
    setPageError('')
    void loadPage(credentials, page, chairQuery, rentalDate, revenuePeriod)
      .then((data) => {
        if (!active) return
        if (data?.page === 'chairs' && data.chairs.length === 0 && chairPage > 0) {
          setChairPage(Math.max(0, Math.ceil(data.total / CHAIR_PAGE_SIZE) - 1))
        } else applyPageData(data)
      })
      .catch((error) => {
        if (active) setPageError(getMessage(error))
      })
      .finally(() => {
        if (active) setPageLoading(false)
      })
    return () => {
      active = false
    }
  }, [credentials, page, reloadKey, chairRequest, applyPageData])

  async function selectRentalDate(date: string) {
    if (credentials === null || !rentals || date === rentalDate) return
    const requestId = ++rentalRequestId.current
    const previousDate = rentals.rentalDate
    setRentalDate(date)
    setRentalLoading(true)
    setRentalError('')
    try {
      const result = await api.overviewRentals(credentials, date)
      if (requestId !== rentalRequestId.current) return
      setRentals(result)
    } catch (error) {
      if (requestId !== rentalRequestId.current) return
      if (error instanceof ApiError && error.status === 401) {
        logout()
        return
      }
      setRentalDate(previousDate)
      setRentalError(getMessage(error))
    } finally {
      if (requestId === rentalRequestId.current) setRentalLoading(false)
    }
  }

  async function selectRevenuePeriod(period: RevenuePeriod) {
    if (credentials === null || !revenue || period === revenuePeriod) return
    const requestId = ++revenueRequestId.current
    const previousPeriod = revenue.period
    setRevenuePeriod(period)
    setRevenueLoading(true)
    setRevenueError('')
    try {
      const result = await api.overviewRevenue(credentials, period)
      if (requestId !== revenueRequestId.current) return
      setRevenue(result)
    } catch (error) {
      if (requestId !== revenueRequestId.current) return
      if (error instanceof ApiError && error.status === 401) {
        logout()
        return
      }
      setRevenuePeriod(previousPeriod)
      setRevenueError(getMessage(error))
    } finally {
      if (requestId === revenueRequestId.current) setRevenueLoading(false)
    }
  }

  function logout() {
    rentalRequestId.current += 1
    revenueRequestId.current += 1
    setCredentials(null)
    setStaff(null)
    setChairs([])
    setChairTotal(0)
    setChairPage(0)
    setChairOptions([])
    setActiveChairCounts({})
    setBranches([])
    setCouriers([])
    setOrders([])
    setRentals(null)
    setRentalDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' }))
    setRentalLoading(false)
    setRentalError('')
    setRevenue(null)
    setRevenuePeriod('MONTH')
    setRevenueLoading(false)
    setRevenueError('')
    setAiKnowledge([])
    setAiUnanswered([])
    setAiNotificationSettings(null)
    setMunicipalities([])
    setBlocks([])
    setPage('overview')
    setPageLoading(false)
    setChairLoading(false)
    setPageError('')
    setLoadedPage(null)
    setBranchFilter('ALL')
    setOrderStatusFilter('ALL')
    setOrderSourceFilter('ALL')
    setNotice('')
  }

  useEffect(() => {
    if (!modal) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setModal(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal, saving])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  function openModal(next: Modal) {
    setFormError('')
    setModal(next)
  }

  function showNotice(message: string) {
    setNotice(message)
  }

  // Mutations refresh the page they changed before closing the form.
  async function saveChair(data: {
    code: string
    model: string
    notes: string
    status: ChairStatus
    branchId: string
  }) {
    if (credentials === null) return
    setSaving(true)
    setFormError('')
    try {
      if (modal?.kind === 'editChair') {
        await api.updateChair(credentials, modal.chair.id, {
          model: data.model,
          notes: data.notes,
          status: data.status,
          branchId: data.branchId,
        })
        showNotice('Poltrona atualizada com sucesso.')
      } else {
        await api.createChair(credentials, {
          code: data.code,
          model: data.model,
          notes: data.notes,
          branchId: data.branchId,
        })
        showNotice('Poltrona cadastrada com sucesso.')
      }
      applyPageData(await loadPage(credentials, 'chairs', chairQuery, rentalDate))
      setModal(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      else setFormError(getMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function saveBranch(data: BranchInput) {
    if (credentials === null) return
    setSaving(true)
    setFormError('')
    try {
      if (modal?.kind === 'editBranch') {
        await api.updateBranch(credentials, modal.branch.id, data)
        showNotice('Filial atualizada com sucesso.')
      } else {
        await api.createBranch(credentials, data)
        showNotice('Filial cadastrada com sucesso.')
      }
      applyPageData(await loadPage(credentials, 'branches', chairQuery, rentalDate))
      setModal(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      else setFormError(getMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function toggleBranchFreeShipping(branch: Branch) {
    if (credentials === null) throw new Error('Entre novamente para continuar.')
    try {
      const updated = await api.setBranchFreeShipping(credentials, branch.id, !branch.freeShipping)
      setBranches(current => current.map(item => item.id === updated.id ? updated : item))
      showNotice(updated.freeShipping ? 'Frete grátis ativado para a filial.' : 'Frete grátis desativado para a filial.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    }
  }

  async function saveCourier(data: CourierInput) {
    if (credentials === null) return
    setSaving(true)
    setFormError('')
    try {
      if (modal?.kind === 'editCourier') {
        await api.updateCourier(credentials, modal.courier.id, data)
        showNotice('Entregador atualizado com sucesso.')
      } else {
        await api.createCourier(credentials, data)
        showNotice('Entregador cadastrado com sucesso.')
      }
      applyPageData(await loadPage(credentials, 'couriers', chairQuery, rentalDate))
      setModal(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      else setFormError(getMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function createBlock(data: {
    chairId: string
    start: string
    end: string
    reason: string
  }) {
    if (credentials === null) return
    await api.createBlock(credentials, data)
    setBlocks(await api.blocks(credentials))
    showNotice('Período bloqueado para esta poltrona.')
  }

  async function deleteBlock(id: string) {
    if (credentials === null) return
    await api.deleteBlock(credentials, id)
    setBlocks(await api.blocks(credentials))
    showNotice('Bloqueio removido.')
  }

  async function mutateOrder(operation: (auth: string) => Promise<Order>) {
    if (credentials === null) throw new Error('Entre novamente para continuar.')
    try {
      const order = await operation(credentials)
      setOrders(current => current.map(item => item.id === order.id ? order : item))
      showNotice('Pedido atualizado.')
      return order
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    }
  }

  async function refreshOrders() {
    if (credentials === null) throw new Error('Entre novamente para continuar.')
    try {
      applyPageData(await loadPage(credentials, 'orders', chairQuery, rentalDate))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    }
  }

  async function createOrderPreview(data: PreviewOrderInput) {
    if (credentials === null) throw new Error('Entre novamente para continuar.')
    try {
      const order = await api.createOrderPreview(credentials, data)
      setOrders(current => [order, ...current])
      showNotice('Pedido de demonstração criado.')
      return order
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    }
  }

  async function deleteOrderPreview(id: string) {
    if (credentials === null) throw new Error('Entre novamente para continuar.')
    try {
      await api.deleteOrderPreview(credentials, id)
      setOrders(current => current.filter(order => order.id !== id))
      showNotice('Pedido de demonstração removido.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    }
  }

  async function changeAiContext(operation: (auth: string) => Promise<unknown>, noticeText: string) {
    if (credentials === null) throw new Error('Entre novamente para continuar.')
    try {
      await operation(credentials)
      applyPageData(await loadPage(credentials, 'ai', chairQuery, rentalDate))
      showNotice(noticeText)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    }
  }

  async function saveAiNotificationSettings(data: AiNotificationSettings) {
    if (credentials === null) throw new Error('Entre novamente para continuar.')
    try {
      setAiNotificationSettings(await api.saveAiNotificationSettings(credentials, data))
      showNotice('Contatos de alerta salvos.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    }
  }

  function navigate(nextPage: Page, filters?: { chairStatus?: ChairStatus | 'ALL'; orderStatus?: OrderStatus }) {
    if (nextPage === 'chairs' && filters?.chairStatus !== undefined) {
      setSearch('')
      setAppliedSearch('')
      setBranchFilter('ALL')
      setChairPage(0)
      setStatusFilter(filters.chairStatus)
    }
    if (nextPage === 'orders') {
      setOrderStatusFilter(filters?.orderStatus ?? 'ALL')
      setOrderSourceFilter(filters?.orderStatus ? 'CHECKOUT' : 'ALL')
    }
    if (nextPage === page) return
    rentalRequestId.current += 1
    revenueRequestId.current += 1
    setRentalLoading(false)
    setRevenueLoading(false)
    setPageLoading(true)
    setPageError('')
    setPage(nextPage)
  }

  function retryPage() {
    rentalRequestId.current += 1
    revenueRequestId.current += 1
    setRentalLoading(false)
    setRentalError('')
    setRevenueLoading(false)
    setRevenueError('')
    setPageLoading(true)
    setReloadKey((key) => key + 1)
  }

  function closeModal() {
    if (!saving) setModal(null)
  }

  // Group props by consumer so App only connects the controller to each screen.
  return {
    session: { credentials, staff, login, loginBusy, loginError, logout },
    navigation: { page, navigate },
    feedback: { pageLoading, pageError, retryPage, notice, dismissNotice: () => setNotice('') },
    overviewPage: {
      rentals,
      rentalDate,
      rentalLoading,
      rentalError,
      onRentalDateChange: (date: string) => { void selectRentalDate(date) },
      revenue,
      revenuePeriod,
      revenueLoading,
      revenueError,
      onRevenuePeriodChange: (period: RevenuePeriod) => { void selectRevenuePeriod(period) },
      onRefresh: retryPage,
    },
    chairsPage: {
      chairs,
      total: chairTotal,
      pageIndex: chairPage,
      options: chairOptions,
      blocks,
      branches,
      loading: chairLoading,
      search,
      status: statusFilter,
      branchId: branchFilter,
      onSearchChange: setSearch,
      onStatusChange: (next: ChairStatus | 'ALL') => {
        setChairPage(0)
        setStatusFilter(next)
      },
      onBranchChange: (next: string) => {
        setChairPage(0)
        setBranchFilter(next)
      },
      onPageChange: setChairPage,
      onNewChair: () => openModal({ kind: 'newChair' }),
      onEditChair: (chair: Chair) => openModal({ kind: 'editChair', chair }),
      onGoBranches: () => navigate('branches'),
      onCreateBlock: createBlock,
      onDeleteBlock: deleteBlock,
    },
    branchesPage: {
      branches,
      activeCounts: activeChairCounts,
      onNewBranch: () => openModal({ kind: 'newBranch' }),
      onEditBranch: (branch: Branch) => openModal({ kind: 'editBranch', branch }),
      onToggleFreeShipping: toggleBranchFreeShipping,
    },
    couriersPage: {
      couriers,
      onNewCourier: () => openModal({ kind: 'newCourier' }),
      onEditCourier: (courier: Courier) => openModal({ kind: 'editCourier', courier }),
    },
    ordersPage: {
      orders, couriers, branches, options: chairOptions,
      status: orderStatusFilter,
      source: orderSourceFilter,
      onStatusChange: setOrderStatusFilter,
      onSourceChange: setOrderSourceFilter,
      onRefresh: refreshOrders,
      onCreatePreview: createOrderPreview,
      onDeletePreview: deleteOrderPreview,
      onChangeStatus: (id: string, status: OrderStatus, note: string) =>
        mutateOrder(auth => api.changeOrderStatus(auth, id, status, note)),
      onAssignCourier: (id: string, courierId: string | null) =>
        mutateOrder(auth => api.assignOrderCourier(auth, id, courierId)),
      onOpenIssue: (id: string, title: string, description: string) =>
        mutateOrder(auth => api.openOrderIssue(auth, id, title, description)),
      onResolveIssue: (id: string, issueId: string, resolution: string) =>
        mutateOrder(auth => api.resolveOrderIssue(auth, id, issueId, resolution)),
    },
    aiPage: {
      knowledge: aiKnowledge,
      unanswered: aiUnanswered,
      onRefresh: () => setReloadKey(key => key + 1),
      onCreateKnowledge: (data: AiKnowledgeInput) =>
        changeAiContext(auth => api.createAiKnowledge(auth, data), 'Resposta adicionada ao contexto.'),
      onUpdateKnowledge: (id: string, data: AiKnowledgeInput) =>
        changeAiContext(auth => api.updateAiKnowledge(auth, id, data), 'Resposta atualizada.'),
      onDeleteKnowledge: (id: string) =>
        changeAiContext(auth => api.deleteAiKnowledge(auth, id), 'Resposta removida do contexto.'),
      onAnswerUnanswered: (id: string, answer: string) =>
        changeAiContext(auth => api.answerAiUnanswered(auth, id, answer), 'Dúvida respondida e adicionada ao contexto.'),
      onDeleteUnanswered: (id: string) =>
        changeAiContext(auth => api.deleteAiUnanswered(auth, id), 'Dúvida excluída.'),
      onRecordUnanswered: (question: string) =>
        changeAiContext(auth => api.recordAiUnanswered(auth, question), 'Dúvida registrada.'),
    },
    notificationsPage: {
      settings: aiNotificationSettings,
      onSave: saveAiNotificationSettings,
    },
    dialog: {
      modal,
      branches,
      municipalities,
      saving,
      error: formError,
      closeModal,
      saveChair,
      saveBranch,
      saveCourier,
    },
  }
}
