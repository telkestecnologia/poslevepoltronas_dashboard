import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  ApiError,
  localLoginBypass,
  type Branch,
  type BranchInput,
  type Chair,
  type ChairOption,
  type ChairQuery,
  type ChairStatus,
  type ManualBlock,
  type Municipality,
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
  const localLoginStarted = useRef(false)
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
    setBranches(data.branches)
    if (data.page === 'chairs') {
      setChairs(data.chairs)
      setChairTotal(data.total)
      setChairOptions(data.options)
      setBlocks(data.blocks)
    } else {
      setActiveChairCounts(data.activeCounts)
      setMunicipalities(data.municipalities)
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

  // A page visit loads its supporting data; filter and page changes reload only the chair rows.
  useEffect(() => {
    if (credentials === null || page === 'overview') {
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
    void loadPage(credentials, page, chairQuery)
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

  function logout() {
    setCredentials(null)
    setStaff(null)
    setChairs([])
    setChairTotal(0)
    setChairPage(0)
    setChairOptions([])
    setActiveChairCounts({})
    setBranches([])
    setMunicipalities([])
    setBlocks([])
    setPage('overview')
    setPageLoading(false)
    setChairLoading(false)
    setPageError('')
    setLoadedPage(null)
    setBranchFilter('ALL')
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
      applyPageData(await loadPage(credentials, 'chairs', chairQuery))
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
      applyPageData(await loadPage(credentials, 'branches', chairQuery))
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

  function navigate(nextPage: Page) {
    setPageLoading(nextPage !== 'overview')
    setPageError('')
    setPage(nextPage)
  }

  function retryPage() {
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
    },
  }
}
