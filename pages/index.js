import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Script from "next/script";
import styles from "../styles/Home.module.css";

const EMPTY_ORDER_FORM = {
  name: "",
  address: "",
  phoneNumber: "",
  items: [{ itemName: "", quantity: 1, price: "" }],
  totalPrice: "",
  trackingNumber: "",
  courier: "",
  deliveryStatus: "Pending",
  cashReceived: "No",
  note: "",
};

const EMPTY_EXPENSE_FORM = {
  description: "",
  amount: "",
  category: "Stock",
  dateTime: new Date().toISOString().split("T")[0],
};

const EMPTY_USER_FORM = {
  username: "",
  password: "",
  name: "",
  role: "packer",
};

const EMPTY_PRODUCT_FORM = {
  name: "",
  stock: 0,
  price: "",
  warranty: "",
};

const EMPTY_DEFECTIVE_FORM = {
  productName: "",
  quantity: 1,
  reason: "",
};

const EMPTY_SETTLEMENT_FORM = {
  courier: "",
  orderIds: [],
};

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

function getOrderTotal(order) {
  if (order.totalPrice != null) return Number(order.totalPrice) || 0;
  if (order.price != null) return Number(order.price) || 0;
  if (order.items?.length) {
    return order.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  }
  return 0;
}

function getOrderStatus(order) {
  return order.deliveryStatus || order.status || "Pending";
}

export default function Home() {
  // Session States
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Data States
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Loading & Error States
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState("");
  
  // Forms & Modal Toggles
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  
  // Form Values
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER_FORM);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);

  // Search and Filters
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [orderCashFilter, setOrderCashFilter] = useState("All");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All");

  // Packer Packing Checklist State
  const [packingChecks, setPackingChecks] = useState({});
  const [packerCourier, setPackerCourier] = useState({});
  const [packerTracking, setPackerTracking] = useState({});
  const [packerSubTab, setPackerSubTab] = useState("pending");
  const [viewMode, setViewMode] = useState("admin");
  const [printOrder, setPrintOrder] = useState(null);
  const [printMode, setPrintMode] = useState("label"); // "label" | "bill"

  // Defectives State
  const [defectives, setDefectives] = useState([]);
  const [loadingDefectives, setLoadingDefectives] = useState(false);
  const [showDefectiveForm, setShowDefectiveForm] = useState(false);
  const [defectiveForm, setDefectiveForm] = useState(EMPTY_DEFECTIVE_FORM);
  const [inventorySubTab, setInventorySubTab] = useState("active");
  const [editingDefectiveId, setEditingDefectiveId] = useState(null);

  // Settlements State
  const [settlements, setSettlements] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlementForm, setSettlementForm] = useState(EMPTY_SETTLEMENT_FORM);
  const [settlementSearchQuery, setSettlementSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [editingSettlementId, setEditingSettlementId] = useState(null);

  const searchDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const effectiveView = currentUser?.role === "packer" ? "packer" : viewMode;

  // Initialize Session
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      const parsedUser = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      if (parsedUser.role === "packer") {
        setActiveTab("packing");
        setViewMode("packer");
      } else {
        setActiveTab("dashboard");
        const params = new URLSearchParams(window.location.search);
        const roleParam = params.get("role");
        if (roleParam === "packer") {
          setViewMode("packer");
          setActiveTab("packing");
        } else {
          setViewMode("admin");
        }
      }
    }
  }, []);

  // Sync ?role= query parameter for admin view switching
  useEffect(() => {
    if (typeof window === "undefined" || currentUser?.role !== "admin") return;
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    if (roleParam === "packer") {
      setViewMode("packer");
      setActiveTab("packing");
    } else if (roleParam === "admin") {
      setViewMode("admin");
    }
  }, [currentUser]);

  useEffect(() => {
    const onAfterPrint = () => setPrintOrder(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const switchViewMode = (mode) => {
    if (currentUser?.role !== "admin") return;
    setViewMode(mode);
    if (mode === "packer") {
      setActiveTab("packing");
      setShowOrderForm(false);
      setShowExpenseForm(false);
      setShowUserForm(false);
      setShowProductForm(false);
    } else {
      setActiveTab("dashboard");
    }
    const url = new URL(window.location.href);
    if (mode === "packer") {
      url.searchParams.set("role", "packer");
    } else {
      url.searchParams.set("role", "admin");
    }
    window.history.replaceState({}, "", url.toString());
  };

  const handlePrintLabel = (order) => {
    setPrintMode("label");
    setPrintOrder(order);
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 150);
    });
  };

  const handlePrintBill = (order) => {
    setPrintMode("bill");
    setPrintOrder(order);
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 150);
    });
  };

  const handleDownloadInvoice = (order) => {
    if (typeof window === "undefined" || !window.html2pdf) {
      alert("PDF library is loading, please wait a moment.");
      return;
    }

    const element = document.createElement("div");
    element.style.padding = "20px";
    element.style.fontFamily = "Arial, sans-serif";
    element.style.color = "#000000";
    element.style.background = "#ffffff";

    const itemsRows = (order.items && order.items.length > 0 ? order.items : [{
      itemName: "Product",
      quantity: order.pieces || 1,
      price: order.price || 0
    }]).map((item, idx) => {
      const selectedProd = products.find(p => p.name === item.itemName);
      const warranty = selectedProd && selectedProd.warranty ? selectedProd.warranty : "";
      return `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 10px 0; font-size: 14px;">
            <div><strong>${item.itemName}</strong></div>
            ${warranty ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Warranty: ${warranty}</div>` : ''}
          </td>
          <td style="padding: 10px 0; text-align: center; font-size: 14px;">${item.quantity}</td>
          <td style="padding: 10px 0; text-align: right; font-size: 14px;">Rs. ${Number(item.price).toFixed(2)}</td>
          <td style="padding: 10px 0; text-align: right; font-size: 14px; font-weight: bold;">Rs. ${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    const orderTotal = (order.totalPrice || order.price || 0).toFixed(2);

    element.innerHTML = `
      <div style="border: 2px solid #333333; padding: 25px; border-radius: 8px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333333; padding-bottom: 15px;">
          <div>
            <h1 style="margin: 0; font-size: 26px; color: #1e293b; font-weight: 800; letter-spacing: -0.5px;">GEOLEX STORE</h1>
            <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">No 52, New Shopping Complex, Imaduwa.</p>
            <p style="margin: 1px 0 0 0; font-size: 12px; color: #64748b;">Tel: 0740136448 / 0776171360</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 20px; color: #475569; font-weight: 700;">INVOICE</h2>
            <p style="margin: 3px 0 0 0; font-size: 13px; font-weight: bold; color: #6366f1;">${order.orderId || 'LEGACY'}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Date: ${new Date(order.dateTime || Date.now()).toLocaleDateString()}</p>
          </div>
        </div>

        <!-- Customer details -->
        <div style="margin: 20px 0; display: grid; grid-template-columns: 1fr; gap: 10px;">
          <div>
            <h3 style="margin: 0 0 5px 0; font-size: 13px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Billed To:</h3>
            <p style="margin: 0; font-size: 15px; font-weight: bold; color: #1e293b;">${order.name}</p>
            <p style="margin: 3px 0 0 0; font-size: 13px; color: #475569; line-height: 1.4;">${order.address}</p>
            <p style="margin: 3px 0 0 0; font-size: 13px; color: #1e293b; font-weight: bold;">📞 Phone: ${order.phoneNumber}</p>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Item Description</th>
              <th style="padding: 8px 0; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748b; width: 60px;">Qty</th>
              <th style="padding: 8px 0; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748b; width: 100px;">Price</th>
              <th style="padding: 8px 0; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748b; width: 110px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Pricing Summary -->
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="max-width: 60%;">
            ${order.note ? `
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Order Notes:</p>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; font-style: italic;">${order.note}</p>
            ` : ''}
          </div>
          <div style="width: 250px; text-align: right;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; color: #475569;">
              <span>Subtotal:</span>
              <span>Rs. ${orderTotal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0 4px 0; font-size: 16px; font-weight: bold; color: #1e293b; border-top: 1px solid #cbd5e1;">
              <span>Total Amount:</span>
              <span style="color: #6366f1;">Rs. ${orderTotal}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 15px; text-align: center;">
          <p style="margin: 0; font-size: 13px; font-weight: bold; color: #475569;">Thank you for your business!</p>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #94a3b8;">This is a system generated document.</p>
        </div>
      </div>
    `;

    const options = {
      margin: 10,
      filename: `Invoice_${order.orderId || 'LEGACY'}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    window.html2pdf().from(element).set(options).save();
  };

  const handleDownloadExpensesReport = () => {
    if (!window.html2pdf) {
      alert("PDF library is still loading. Please try again in a few seconds.");
      return;
    }

    const element = document.createElement("div");
    element.style.fontFamily = "'Inter', 'Segoe UI', sans-serif";
    element.style.color = "#1e293b";
    element.style.padding = "20px";

    const totalExp = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const categoryTotals = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (Number(e.amount) || 0);
      return acc;
    }, {});

    const categoryBreakdownRows = Object.keys(categoryTotals).map(cat => `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #475569;">
        <span>${cat}:</span>
        <span style="font-weight: bold;">Rs. ${categoryTotals[cat].toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>
    `).join("");

    const expenseRows = expenses.map(e => `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 10px 0; font-size: 13px;">${new Date(e.dateTime || Date.now()).toLocaleDateString()}</td>
        <td style="padding: 10px 0; font-size: 13px; font-weight: bold;">${e.description}</td>
        <td style="padding: 10px 0; font-size: 13px;">
          <span style="padding: 2px 6px; font-size: 11px; background: #e2e8f0; color: #334155; border-radius: 4px; font-weight: bold;">
            ${e.category}
          </span>
        </td>
        <td style="padding: 10px 0; text-align: right; font-size: 13px; font-weight: bold;">Rs. ${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    element.innerHTML = `
      <div style="border: 2px solid #333333; padding: 25px; border-radius: 8px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333333; padding-bottom: 15px;">
          <div>
            <h1 style="margin: 0; font-size: 26px; color: #1e293b; font-weight: 800; letter-spacing: -0.5px;">GEOLEX STORE</h1>
            <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">No 52, New Shopping Complex, Imaduwa.</p>
            <p style="margin: 1px 0 0 0; font-size: 12px; color: #64748b;">Expenses Log Summary Report</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 18px; color: #475569; font-weight: 700;">EXPENSES REPORT</h2>
            <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">Date Generated: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <!-- Summary Statistics Block -->
        <div style="margin: 20px 0; display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; padding: 15px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1;">
          <div>
            <h3 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Category Breakdown:</h3>
            ${categoryBreakdownRows}
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; justify-content: center; align-items: flex-end;">
            <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold;">Total Expenses:</p>
            <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 900; color: #ef4444;">Rs. ${totalExp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Total Records: ${expenses.length}</p>
          </div>
        </div>

        <!-- Table of Expenses -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="border-bottom: 2px solid #333333; text-align: left;">
              <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b; width: 100px;">Date</th>
              <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Description</th>
              <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b; width: 120px;">Category</th>
              <th style="padding: 8px 0; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748b; width: 120px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenseRows}
          </tbody>
        </table>

        <!-- Footer -->
        <div style="margin-top: 45px; border-top: 1px dashed #cbd5e1; padding-top: 15px; text-align: center;">
          <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">BizManager Pro - Expenses Tracking Summary</p>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #94a3b8;">This is a system generated report.</p>
        </div>
      </div>
    `;

    const options = {
      margin: 10,
      filename: `Expenses_Report_${new Date().toISOString().split("T")[0]}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    window.html2pdf().from(element).set(options).save();
  };

  // Fetch Dashboard Stats (Admin Only)
  const fetchStats = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingStats(true);
    try {
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      } else {
        setError(data.error || "Failed to load dashboard metrics.");
      }
    } catch {
      setError("Dashboard loading error.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Orders
  const fetchOrders = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setError("Failed to load orders.");
      }
    } catch {
      setError("Orders loading error.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // Fetch Expenses (Admin Only)
  const fetchExpenses = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingExpenses(true);
    try {
      const res = await fetch("/api/expenses", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setExpenses(data);
      } else {
        setError("Failed to load expenses.");
      }
    } catch {
      setError("Expenses loading error.");
    } finally {
      setLoadingExpenses(false);
    }
  }, []);

  // Fetch Users (Admin Only)
  const fetchUsers = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setError("Failed to load users.");
      }
    } catch {
      setError("Users loading error.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch Products
  const fetchProducts = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setError("Failed to load products.");
      }
    } catch {
      setError("Products loading error.");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Fetch Defective Logs
  const fetchDefectives = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingDefectives(true);
    try {
      const res = await fetch("/api/defectives", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setDefectives(data);
      }
    } catch {
      setError("Defective logs loading error.");
    } finally {
      setLoadingDefectives(false);
    }
  }, []);

  // Fetch Settlements
  const fetchSettlements = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingSettlements(true);
    try {
      const res = await fetch("/api/settlements", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSettlements(data);
      }
    } catch {
      setError("Settlements loading error.");
    } finally {
      setLoadingSettlements(false);
    }
  }, []);

  // Synchronized Refreshes
  const refreshData = useCallback((authToken = token, userRole = currentUser?.role) => {
    if (!authToken) return;
    fetchOrders(authToken);
    fetchProducts(authToken);
    if (userRole === "admin") {
      fetchStats(authToken);
      fetchExpenses(authToken);
      fetchUsers(authToken);
      fetchDefectives(authToken);
      fetchSettlements(authToken);
    }
  }, [token, currentUser, fetchOrders, fetchProducts, fetchStats, fetchExpenses, fetchUsers, fetchDefectives, fetchSettlements]);

  useEffect(() => {
    if (token && currentUser) {
      refreshData(token, currentUser.role);
    }
  }, [token, currentUser, refreshData]);

  // Auth Handlers
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!loginUsername || !loginPassword) {
      setLoginError("Please enter both credentials.");
      return;
    }
    setAuthenticating(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setToken(data.token);
        setCurrentUser(data.user);
        setLoginUsername("");
        setLoginPassword("");
        if (data.user.role === "packer") {
          setActiveTab("packing");
          setViewMode("packer");
        } else {
          setActiveTab("dashboard");
          setViewMode("admin");
        }
      } else {
        setLoginError(data.error || "Login failed.");
      }
    } catch {
      setLoginError("Network connection failed.");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setCurrentUser(null);
    setOrders([]);
    setExpenses([]);
    setStats(null);
    setUsers([]);
  };

  // Order Form Item Handlers
  const handleItemChange = (index, field, value) => {
    setOrderForm((f) => {
      const updatedItems = [...f.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...f, items: updatedItems };
    });
  };

  const addItemRow = () => {
    setOrderForm((f) => ({
      ...f,
      items: [...f.items, { itemName: "", quantity: 1, price: "" }]
    }));
  };

  const removeItemRow = (index) => {
    if (orderForm.items.length <= 1) return;
    const updatedItems = orderForm.items.filter((_, i) => i !== index);
    setOrderForm((f) => ({ ...f, items: updatedItems }));
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { name, address, items, totalPrice } = orderForm;
    if (!name || !address) {
      setFormError("Customer name and address are required.");
      return;
    }

    if (totalPrice === undefined || totalPrice === "" || isNaN(Number(totalPrice))) {
      setFormError("Total Order Price (Rs.) is required.");
      return;
    }
    
    const invalidItem = items.some(item => !item.itemName || !item.price || Number(item.price) <= 0 || Number(item.quantity) <= 0);
    if (invalidItem) {
      setFormError("Please enter valid item name, quantity, and price.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingOrderId ? `/api/orders/${editingOrderId}` : "/api/orders";
      const method = editingOrderId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(orderForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to save order.");
        return;
      }

      setOrderForm(EMPTY_ORDER_FORM);
      setShowOrderForm(false);
      setEditingOrderId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateOrderEdit = (order) => {
    setOrderForm({
      name: order.name,
      address: order.address,
      phoneNumber: order.phoneNumber,
      items: order.items && order.items.length > 0 ? order.items.map(i => ({
        itemName: i.itemName,
        quantity: i.quantity,
        price: i.price,
      })) : [{ itemName: "Earbuds / Product", quantity: order.pieces || 1, price: order.price || 0 }],
      totalPrice: order.totalPrice || "",
      trackingNumber: order.trackingNumber || "",
      courier: order.courier || "",
      deliveryStatus: order.deliveryStatus || order.status || "Pending",
      cashReceived: order.cashReceived || (order.status === "Approved" ? "Yes" : "No"),
      note: order.note || "",
    });
    setEditingOrderId(order._id);
    setShowOrderForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOrderDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        setError("Failed to delete order.");
      }
    } catch {
      setError("Failed to delete order.");
    }
  };

  const handleQuickStatusChange = async (orderId, updates) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        refreshData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to update status.");
      }
    } catch {
      setError("Network error when updating status.");
    }
  };

  // Expense Handlers
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { description, amount, category } = expenseForm;
    if (!description || !amount || Number(amount) <= 0 || !category) {
      setFormError("All fields must be valid.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingExpenseId ? `/api/expenses/${editingExpenseId}` : "/api/expenses";
      const method = editingExpenseId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(expenseForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to save expense.");
        return;
      }

      setExpenseForm(EMPTY_EXPENSE_FORM);
      setShowExpenseForm(false);
      setEditingExpenseId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateExpenseEdit = (expense) => {
    setExpenseForm({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      dateTime: expense.dateTime ? new Date(expense.dateTime).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });
    setEditingExpenseId(expense._id);
    setShowExpenseForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExpenseDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        setError("Failed to delete expense.");
      }
    } catch {
      setError("Failed to delete expense.");
    }
  };

  // User CRUD Form Submission
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { username, password, name, role } = userForm;
    if (!username || !name || !role || (!editingUserId && !password)) {
      setFormError("Please fill out all fields.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to save user.");
        return;
      }

      setUserForm(EMPTY_USER_FORM);
      setShowUserForm(false);
      setEditingUserId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateUserEdit = (userObj) => {
    setUserForm({
      username: userObj.username,
      password: "", 
      name: userObj.name,
      role: userObj.role,
    });
    setEditingUserId(userObj._id);
    setShowUserForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUserDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete user.");
      }
    } catch {
      setError("Failed to delete user.");
    }
  };

  // Product CRUD Handlers
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { name, stock, price, warranty } = productForm;
    if (!name || name.trim() === "") {
      setFormError("Product name is required.");
      return;
    }
    if (Number(price) < 0 || Number(stock) < 0) {
      setFormError("Stock and price must be non-negative.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingProductId ? `/api/products/${editingProductId}` : "/api/products";
      const method = editingProductId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(productForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to save product.");
        return;
      }

      setProductForm(EMPTY_PRODUCT_FORM);
      setShowProductForm(false);
      setEditingProductId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateProductEdit = (prod) => {
    setProductForm({
      name: prod.name,
      stock: prod.stock,
      price: prod.price,
      warranty: prod.warranty || "",
    });
    setEditingProductId(prod._id);
    setShowProductForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProductDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        setError("Failed to delete product.");
      }
    } catch {
      setError("Failed to delete product.");
    }
  };

  const handleDefectiveSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { productName, quantity } = defectiveForm;
    if (!productName) {
      setFormError("Product is required.");
      return;
    }
    if (Number(quantity) <= 0) {
      setFormError("Quantity must be greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingDefectiveId ? `/api/defectives/${editingDefectiveId}` : "/api/defectives";
      const method = editingDefectiveId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(defectiveForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to log defective item.");
        return;
      }

      setDefectiveForm(EMPTY_DEFECTIVE_FORM);
      setShowDefectiveForm(false);
      setEditingDefectiveId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateDefectiveEdit = (log) => {
    setDefectiveForm({
      productName: log.productName,
      quantity: log.quantity,
      reason: log.reason || "",
    });
    setEditingDefectiveId(log._id);
    setShowDefectiveForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDefectiveDelete = async (id, restore = true) => {
    const msg = restore 
      ? "Are you sure you want to restore these items to active stock?" 
      : "Are you sure you want to permanently discard these items? (Stock will NOT be restored)";
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/defectives/${id}?restore=${restore}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        setError("Failed to delete defective log.");
      }
    } catch {
      setError("Failed to delete defective log.");
    }
  };

  // Settlement CRUD Handlers
  const handleSettlementSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { courier, orderIds } = settlementForm;
    if (!orderIds || orderIds.length === 0) {
      setFormError("Please select at least one order to settle.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingSettlementId ? `/api/settlements/${editingSettlementId}` : "/api/settlements";
      const method = editingSettlementId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settlementForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to record settlement.");
        return;
      }

      setSettlementForm(EMPTY_SETTLEMENT_FORM);
      setShowSettlementForm(false);
      setEditingSettlementId(null);
      setSettlementSearchQuery("");
      setShowSearchDropdown(false);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateSettlementEdit = (setObj) => {
    setSettlementForm({
      courier: setObj.courier || "",
      orderIds: setObj.orders.map(o => o._id || o),
    });
    setEditingSettlementId(setObj._id);
    setShowSettlementForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSettlementDelete = async (id) => {
    if (!confirm("Are you sure you want to revert this settlement? The associated orders' cash statuses will be marked back as pending (Cash Received = No).")) return;
    try {
      const res = await fetch(`/api/settlements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        setError("Failed to delete settlement.");
      }
    } catch {
      setError("Failed to delete settlement.");
    }
  };

  // Packer Confirmation Workflow
  const handleTogglePackCheck = (orderId, idx) => {
    setPackingChecks((prev) => {
      const orderChecks = prev[orderId] || {};
      const newChecks = { ...orderChecks, [idx]: !orderChecks[idx] };
      return { ...prev, [orderId]: newChecks };
    });
  };

  const handlePackerConfirmPacked = async (order) => {
    const courierVal = packerCourier[order._id] || "";
    const trackingVal = packerTracking[order._id] || "";

    if (!courierVal) {
      alert("Please enter the courier service name before confirming (E.g. Koombiyo).");
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order._id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          deliveryStatus: "Delivered",
          courier: courierVal,
          trackingNumber: trackingVal,
        }),
      });

      if (res.ok) {
        alert(`Order ${order.orderId || ""} successfully packed and dispatched!`);
        refreshData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to confirm packed.");
      }
    } catch {
      alert("Network error. Please try again.");
    }
  };

  // Filter Logics
  const filteredOrders = orders.filter((order) => {
    const searchLower = orderSearch.toLowerCase();
    const orderIdStr = order.orderId ? order.orderId.toLowerCase() : "";
    const nameStr = order.name ? order.name.toLowerCase() : "";
    const phoneStr = order.phoneNumber ? order.phoneNumber.toLowerCase() : "";
    const trackingStr = order.trackingNumber ? order.trackingNumber.toLowerCase() : "";
    const courierStr = order.courier ? order.courier.toLowerCase() : "";
    
    const itemsMatch = order.items && order.items.some(
      (item) => item.itemName && item.itemName.toLowerCase().includes(searchLower)
    );

    const matchesSearch = 
      orderIdStr.includes(searchLower) ||
      nameStr.includes(searchLower) ||
      phoneStr.includes(searchLower) ||
      trackingStr.includes(searchLower) ||
      courierStr.includes(searchLower) ||
      itemsMatch;

    const currentStatus = order.deliveryStatus || order.status || "Pending";
    const matchesStatus = orderStatusFilter === "All" || currentStatus === orderStatusFilter;

    const currentCash = order.cashReceived || (order.status === "Approved" ? "Yes" : "No");
    const matchesCash = orderCashFilter === "All" || currentCash === orderCashFilter;

    return matchesSearch && matchesStatus && matchesCash;
  });

  const filteredExpenses = expenses.filter((expense) => {
    return expenseCategoryFilter === "All" || expense.category === expenseCategoryFilter;
  });

  const packerPendingOrders = orders.filter((o) => getOrderStatus(o) === "Pending");
  const packerCompletedOrders = orders.filter((o) => getOrderStatus(o) !== "Pending");

  if (!token) {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>BizManager Pro</h1>
          <p className={styles.loginSubtitle}>Sign in to manage online store</p>
          {loginError && <div className={styles.formError}>{loginError}</div>}
          <form onSubmit={handleLoginSubmit} className={styles.form}>
            <div className={styles.field} style={{ textAlign: "left" }}>
              <label className={styles.label}>Username</label>
              <input
                className={styles.input}
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            <div className={styles.field} style={{ textAlign: "left" }}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" className={styles.submitBtn} style={{ marginTop: "12px" }} disabled={authenticating}>
              {authenticating ? "Authenticating…" : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />
      {/* ── CSS PRINT STYLES - COMPACT VERTICAL LAYOUT ── */}
      <style jsx global>{`
        @media print {
          /* Hide everything outside the portal */
          body * {
            display: none !important;
          }
          #print-container, 
          #print-container * {
            display: block !important;
            box-sizing: border-box !important;
          }
          /* Custom print container setup */
          #print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Outer rounded card setup */
          .thermalLabelCard {
            width: 145mm !important;
            height: 52mm !important;
            max-height: 52mm !important;
            border: 2px solid #000000 !important;
            border-radius: 8px !important;
            padding: 6px 12px !important;
            font-family: Arial, sans-serif !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          /* High-contrast top header bar for COD */
          .thermalLabelCod {
            display: flex !important;
            flex-direction: row !important;
            align-items: stretch !important;
            border: 2px solid #000000 !important;
            border-radius: 4px !important;
            width: 60% !important;
            margin: 0 auto 5px auto !important;
            overflow: hidden !important;
          }
          .thermalLabelCodLeft {
            background-color: #000000 !important;
            color: #ffffff !important;
            font-weight: bold !important;
            font-size: 11pt !important;
            padding: 2px 8px !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
          }
          .thermalLabelCodRight {
            color: #000000 !important;
            font-weight: bold !important;
            font-size: 11pt !important;
            padding: 2px 8px !important;
            flex-grow: 1 !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          /* STRICT VERTICAL FLOW: FROM first, then TO directly below it */
          .thermalLabelContentStack {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            gap: 4px !important;
          }
          .thermalLabelRowBlock {
            display: block !important;
            width: 100% !important;
            padding: 2px 0 !important;
          }
          .thermalLabelFromBlock {
            border-bottom: 1px dashed #000000 !important;
            padding-bottom: 3px !important;
          }
          /* Inline design to save extreme space and length */
          .thermalLabelLineInline {
            display: inline !important;
            font-size: 10.5pt !important;
            line-height: 1.2 !important;
          }
          .thermalLabelTag {
            font-weight: bold !important;
            font-size: 11pt !important;
            text-transform: uppercase !important;
            display: inline !important;
            margin-right: 4px !important;
          }
          .thermalLabelPhoneInline {
            font-weight: bold !important;
            font-size: 11pt !important;
            display: inline !important;
            margin-left: 6px !important;
          }
          /* Bill Thermal print styles */
          .thermalBillCard {
            width: 80mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 10pt !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          .thermalBillDivider {
            border-top: 1px dashed #000000 !important;
            margin: 8px 0 !important;
            height: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <h1 className={styles.title}>BizManager Pro</h1>
            <p className={styles.subtitle}>
              Hello, <strong>{currentUser?.name}</strong> ({currentUser?.role})
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {currentUser?.role === "admin" && (
              <div className={styles.roleSwitcher} title="Switch dashboard view">
                <button
                  type="button"
                  className={`${styles.roleSwitchBtn} ${effectiveView === "admin" ? styles.roleSwitchActive : ""}`}
                  onClick={() => switchViewMode("admin")}
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  className={`${styles.roleSwitchBtn} ${effectiveView === "packer" ? styles.roleSwitchActive : ""}`}
                  onClick={() => switchViewMode("packer")}
                >
                  📦 Packer
                </button>
              </div>
            )}
            {/* Action buttons removed from main header */}
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout 🔒
            </button>
          </div>
        </div>
      </header>

      {/* ── Tabs Container ── */}
      {effectiveView === "admin" && (
        <div className={styles.tabsContainer}>
          <button className={`${styles.tab} ${activeTab === "dashboard" ? styles.activeTab : ""}`} onClick={() => setActiveTab("dashboard")}>📈 Analytics</button>
          <button className={`${styles.tab} ${activeTab === "orders" ? styles.activeTab : ""}`} onClick={() => setActiveTab("orders")}>📦 Orders ({orders.length})</button>
          <button className={`${styles.tab} ${activeTab === "inventory" ? styles.activeTab : ""}`} onClick={() => setActiveTab("inventory")}>🗄️ Inventory ({products.length})</button>
          <button className={`${styles.tab} ${activeTab === "expenses" ? styles.activeTab : ""}`} onClick={() => setActiveTab("expenses")}>💸 Expenses ({expenses.length})</button>
          <button className={`${styles.tab} ${activeTab === "settlements" ? styles.activeTab : ""}`} onClick={() => setActiveTab("settlements")}>🤝 Settlements ({settlements.length})</button>
          <button className={`${styles.tab} ${activeTab === "users" ? styles.activeTab : ""}`} onClick={() => setActiveTab("users")}>👥 User Accounts ({users.length})</button>
        </div>
      )}

      <main className={styles.main}>
        {error && <div className={styles.formError} style={{ margin: 0 }}>{error}</div>}

        {/* ── FORM: Order Form ── */}
        {showOrderForm && effectiveView === "admin" && currentUser?.role === "admin" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{editingOrderId ? "Edit Order details" : "Add New Order"}</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleOrderSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Customer Name</label>
                  <input className={styles.input} value={orderForm.name} onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })} placeholder="E.g. Deshan" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone Number</label>
                  <input className={styles.input} value={orderForm.phoneNumber} onChange={(e) => setOrderForm({ ...orderForm, phoneNumber: e.target.value })} placeholder="E.g. 0771234567" />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label className={styles.label}>Delivery Address</label>
                  <input className={styles.input} value={orderForm.address} onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })} placeholder="No. 12, Galle Road" required />
                </div>
              </div>

              <div className={styles.itemsSection}>
                <div className={styles.itemsHeader}>
                  <label className={styles.label}>Order Items List</label>
                  <button type="button" onClick={addItemRow} className={styles.addItemBtn}>+ Add Item Row</button>
                </div>
                {orderForm.items.map((item, index) => (
                  <div key={index} className={styles.itemsGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Product Item Name</label>
                      <select
                        className={styles.select}
                        value={item.itemName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const selectedProd = products.find(p => p.name === val);
                          setOrderForm((f) => {
                            const updatedItems = [...f.items];
                            updatedItems[index] = {
                              ...updatedItems[index],
                              itemName: val,
                              price: selectedProd ? selectedProd.price : updatedItems[index].price
                            };
                            return { ...f, items: updatedItems };
                          });
                        }}
                        required
                      >
                        <option value="">-- Select Product --</option>
                        {products.map((p) => (
                          <option key={p._id} value={p.name}>
                            {p.name} (Stock: {p.stock})
                          </option>
                        ))}
                        {item.itemName && !products.some(p => p.name === item.itemName) && (
                          <option value={item.itemName}>{item.itemName} (Not in Inventory)</option>
                        )}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Qty</label>
                      <input className={styles.input} type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))} required />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Unit Price (Rs.)</label>
                      <input className={styles.input} type="number" step="0.01" placeholder="0.00" value={item.price} onChange={(e) => handleItemChange(index, "price", e.target.value)} required />
                    </div>
                    {orderForm.items.length > 1 && (
                      <button type="button" onClick={() => removeItemRow(index)} className={styles.removeItemBtn} title="Remove product">✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Courier Service</label>
                  <input className={styles.input} value={orderForm.courier} onChange={(e) => setOrderForm({ ...orderForm, courier: e.target.value })} placeholder="E.g. Koombiyo" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Tracking Number</label>
                  <input className={styles.input} value={orderForm.trackingNumber} onChange={(e) => setOrderForm({ ...orderForm, trackingNumber: e.target.value })} placeholder="E.g. KB10098234" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Delivery Status</label>
                  <select className={styles.select} value={orderForm.deliveryStatus} onChange={(e) => setOrderForm({ ...orderForm, deliveryStatus: e.target.value })}>
                    <option value="Pending">⌛ Pending</option>
                    <option value="Delivered">🚚 Delivered</option>
                    <option value="Return">🔄 Returned</option>
                    <option value="Completed">✅ Completed</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Cash Received?</label>
                  <select className={styles.select} value={orderForm.cashReceived} onChange={(e) => setOrderForm({ ...orderForm, cashReceived: e.target.value })}>
                    <option value="No">❌ No</option>
                    <option value="Yes">💵 Yes</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Total Order Price (Rs.) <span style={{ color: "red" }}>*</span></label>
                  <input
                    className={styles.input}
                    type="number"
                    step="0.01"
                    placeholder={`Calculated total: Rs. ${orderForm.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0)}`}
                    value={orderForm.totalPrice}
                    onChange={(e) => setOrderForm({ ...orderForm, totalPrice: e.target.value })}
                    required
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label className={styles.label}>Note</label>
                  <input className={styles.input} value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })} placeholder="Additional details" />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowOrderForm(false); setFormError(""); setOrderForm(EMPTY_ORDER_FORM); setEditingOrderId(null); }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving…" : editingOrderId ? "Update Order" : "Add Order"}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── FORM: Expense Form ── */}
        {showExpenseForm && effectiveView === "admin" && currentUser?.role === "admin" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{editingExpenseId ? "Edit Expense details" : "Log Business Expense"}</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleExpenseSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Description / Purpose</label>
                  <input className={styles.input} value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="E.g. Stock" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Amount (Rs.)</label>
                  <input className={styles.input} type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Expense Category</label>
                  <select className={styles.select} value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    <option value="Stock">📦 Stock Buying</option>
                    <option value="Courier">🚚 Courier Charges</option>
                    <option value="Marketing">📢 Marketing / Ads</option>
                    <option value="Other">💼 Other Expenses</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Expense Date</label>
                  <input className={styles.input} type="date" value={expenseForm.dateTime} onChange={(e) => setExpenseForm({ ...expenseForm, dateTime: e.target.value })} required />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowExpenseForm(false); setFormError(""); setExpenseForm(EMPTY_EXPENSE_FORM); setEditingExpenseId(null); }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving…" : editingExpenseId ? "Update Expense" : "Save Expense"}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── FORM: User Account Form ── */}
        {showUserForm && effectiveView === "admin" && currentUser?.role === "admin" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{editingUserId ? "Edit User details" : "Create User Account"}</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleUserSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Full Name</label>
                  <input className={styles.input} value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="E.g. Kamal" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Username</label>
                  <input className={styles.input} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="E.g. kamal_packer" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Password {editingUserId && "(leave blank to keep current)"}</label>
                  <input className={styles.input} type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Enter password" required={!editingUserId} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Role</label>
                  <select className={styles.select} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                    <option value="packer">📦 Packer (Confirm packing only)</option>
                    <option value="admin">👑 Admin (Full dashboard access)</option>
                  </select>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowUserForm(false); setFormError(""); setUserForm(EMPTY_USER_FORM); setEditingUserId(null); }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving User…" : editingUserId ? "Update User" : "Create User"}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── FORM: Product Form ── */}
        {showProductForm && effectiveView === "admin" && currentUser?.role === "admin" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{editingProductId ? "Edit Product details" : "Add New Product"}</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleProductSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Product Name</label>
                  <input className={styles.input} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="E.g. Earbuds Pro" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Stock Quantity</label>
                  <input className={styles.input} type="number" min="0" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Default Unit Price (Rs.)</label>
                  <input className={styles.input} type="number" step="0.01" placeholder="0.00" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Warranty</label>
                  <input className={styles.input} value={productForm.warranty} onChange={(e) => setProductForm({ ...productForm, warranty: e.target.value })} placeholder="E.g. 6 Months / 1 Year" />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowProductForm(false); setFormError(""); setProductForm(EMPTY_PRODUCT_FORM); setEditingProductId(null); }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving Product…" : editingProductId ? "Update Product" : "Add Product"}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB 1: ANALYTICS DASHBOARD ── */}
        {activeTab === "dashboard" && effectiveView === "admin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {loadingStats ? (
              <div className={styles.spinner} />
            ) : stats ? (
              <>
                <div className={styles.kpiGrid}>
                  <div className={`${styles.kpiCard} ${styles.kpiCardProfit}`}>
                    <span className={styles.kpiLabel}>Net Profit</span>
                    <span className={`${styles.kpiValue} ${stats.netProfit >= 0 ? styles.positive : styles.negative}`}>
                      Rs. {stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Revenue minus logged expenses</span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Total Revenue</span>
                    <span className={styles.kpiValue} style={{ color: "var(--approved)" }}>
                      Rs. {stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Delivered/Completed + Cashed orders</span>
                  </div>
                  <div className={`${styles.kpiCard} ${styles.kpiCardExpenses}`}>
                    <span className={styles.kpiLabel}>Total Expenses</span>
                    <span className={styles.kpiValue} style={{ color: "var(--error)" }}>
                      Rs. {stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Total spent across {stats.expenseCount} logs</span>
                  </div>
                  <div className={`${styles.kpiCard} ${styles.kpiCardOrders}`}>
                    <span className={styles.kpiLabel}>Total Gross Sales</span>
                    <span className={styles.kpiValue}>
                      Rs. {stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Sum of all {stats.orderCount} orders</span>
                  </div>
                </div>

                <div className={styles.dashboardContent}>
                  <div className={styles.chartCard}>
                    <h3 className={styles.sectionTitle}>🚚 Delivery status Tracking</h3>
                    <div className={styles.statusGrid}>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--pending)" }}>
                        <span className={styles.kpiLabel}>Pending</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Pending}</span>
                      </div>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--primary)" }}>
                        <span className={styles.kpiLabel}>Delivered</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Delivered}</span>
                      </div>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--error)" }}>
                        <span className={styles.kpiLabel}>Returned</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Return}</span>
                      </div>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--approved)" }}>
                        <span className={styles.kpiLabel}>Completed</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Completed}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.chartCard}>
                    <h3 className={styles.sectionTitle}>💵 Cash Summary</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                        <span className={styles.kpiLabel} style={{ textTransform: "none" }}>Cash Received:</span>
                        <span style={{ fontWeight: "700", color: "var(--approved)" }}>Rs. {stats.cashValue.Yes.toLocaleString()} ({stats.cashCounts.Yes} orders)</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                        <span className={styles.kpiLabel} style={{ textTransform: "none" }}>Cash Pending:</span>
                        <span style={{ fontWeight: "700", color: "var(--pending)" }}>Rs. {stats.cashValue.No.toLocaleString()} ({stats.cashCounts.No} orders)</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className={styles.kpiLabel} style={{ textTransform: "none" }}>Pending Shipments Value:</span>
                        <span style={{ fontWeight: "700", color: "var(--text-muted)" }}>Rs. {stats.pendingDeliveryVal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyCell}>Loading Dashboard metrics...</div>
            )}
          </div>
        )}

        {/* ── TAB 2: ORDERS MANAGER ── */}
        {activeTab === "orders" && effectiveView === "admin" && (
          <>
            <div className={styles.filtersRow}>
              <input
                className={`${styles.input} ${styles.searchBar}`}
                placeholder="🔍 Search name, phone, tracking number, item, or order ID..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
              <div className={styles.field} style={{ minWidth: "140px" }}>
                <select className={styles.select} value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Return">Returned</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className={styles.field} style={{ minWidth: "140px" }}>
                <select className={styles.select} value={orderCashFilter} onChange={(e) => setOrderCashFilter(e.target.value)}>
                  <option value="All">All Payment States</option>
                  <option value="Yes">Cash Received</option>
                  <option value="No">Cash Pending</option>
                </select>
              </div>
            </div>

            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderInner}>
                  <span className={styles.sectionTitle} style={{ margin: 0 }}>Orders Log</span>
                  <span className={styles.count}>{filteredOrders.length} orders found</span>
                </div>
                <button
                  className={styles.addBtn}
                  style={{ margin: 0, padding: "6px 12px", fontSize: "13px" }}
                  onClick={() => {
                    setShowOrderForm((v) => !v);
                    setShowExpenseForm(false);
                    setShowUserForm(false);
                    setShowProductForm(false);
                    setFormError("");
                    setEditingOrderId(null);
                    setOrderForm(EMPTY_ORDER_FORM);
                    if (!showOrderForm) window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {showOrderForm ? "✕ Close Form" : "+ New Order"}
                </button>
              </div>

              {/* Desktop Table */}
              <div className={`${styles.tableWrap} ${styles.desktopTableOnly}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer Details</th>
                      <th>Product Items (Qty)</th>
                      <th>Total Value</th>
                      <th>Courier & Tracking</th>
                      <th>Delivery Status</th>
                      <th>Cash Recv?</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOrders ? (
                      <tr><td colSpan={10} className={styles.emptyCell}><div className={styles.spinner} style={{ margin: 0 }} /> Loading...</td></tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr><td colSpan={10} className={styles.emptyCell}>No orders matched your filters.</td></tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const statusClass = 
                          order.deliveryStatus === "Completed" ? styles.rowCompleted :
                          order.deliveryStatus === "Return" ? styles.rowReturn :
                          order.deliveryStatus === "Delivered" ? styles.rowDelivered :
                          styles.rowPending;

                        return (
                          <tr key={order._id} className={statusClass}>
                            <td className={styles.itemNum}>{order.orderId || "LEGACY"}</td>
                            <td className={styles.dateCell}>{formatDateTime(order.dateTime)}</td>
                            <td>
                              <div style={{ fontWeight: "600" }}>{order.name}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>📞 {order.phoneNumber}</div>
                              <div className={styles.address}>{order.address}</div>
                            </td>
                            <td>
                              <div className={styles.itemsList}>
                                {order.items && order.items.length > 0 ? (
                                  order.items.map((it, idx) => (
                                    <div key={idx} className={styles.itemLabel}>• {it.itemName} <span className={styles.itemQty}>(x{it.quantity})</span></div>
                                  ))
                                ) : (
                                  <div className={styles.itemLabel}>• Product <span className={styles.itemQty}>(x{order.pieces || 1})</span></div>
                                )}
                              </div>
                            </td>
                            <td style={{ fontWeight: "700", whiteSpace: "nowrap" }}>Rs. {(order.totalPrice || order.price || 0).toLocaleString()}</td>
                            <td>
                              {order.courier ? (
                                <div>
                                  <div style={{ fontWeight: "600" }}>{order.courier}</div>
                                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>{order.trackingNumber || "No tracking"}</div>
                                </div>
                              ) : <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Not dispatched</span>}
                            </td>
                            <td>
                              <div className={styles.quickStatusWrapper}>
                                <select className={styles.quickSelect} value={order.deliveryStatus || order.status || "Pending"} onChange={(e) => handleQuickStatusChange(order._id, { deliveryStatus: e.target.value })}>
                                  <option value="Pending">Pending</option>
                                  <option value="Delivered">Delivered</option>
                                  <option value="Return">Returned</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              </div>
                            </td>
                            <td>
                              <span style={{ cursor: "pointer" }} onClick={() => handleQuickStatusChange(order._id, { cashReceived: (order.cashReceived === "Yes" ? "No" : "Yes") })} className={`${styles.badge} ${order.cashReceived === "Yes" ? styles.badgeYes : styles.badgeNo}`}>{order.cashReceived === "Yes" ? "Yes" : "No"}</span>
                            </td>
                            <td className={styles.noteCell}>{order.note}</td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button className={styles.printBtn} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                                <button className={styles.printBtn} style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", border: "none" }} onClick={() => handlePrintBill(order)}>🧾 Print Bill</button>
                                <button className={styles.printBtn} style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", border: "none" }} onClick={() => handleDownloadInvoice(order)}>📄 Download PDF</button>
                                <button className={styles.editBtn} onClick={() => initiateOrderEdit(order)}>Edit</button>
                                <button className={styles.deleteBtn} onClick={() => handleOrderDelete(order._id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className={styles.mobileCardsOnly}>
                {loadingOrders ? (
                  <div className={styles.spinner} />
                ) : filteredOrders.length === 0 ? (
                  <div className={styles.emptyCell}>No orders matched your filters.</div>
                ) : (
                  filteredOrders.map((order) => {
                    const statusClass = 
                      order.deliveryStatus === "Completed" ? styles.rowCompleted :
                      order.deliveryStatus === "Return" ? styles.rowReturn :
                      order.deliveryStatus === "Delivered" ? styles.rowDelivered :
                      styles.rowPending;

                    return (
                      <div key={order._id} className={`${styles.mobileOrderCard} ${statusClass}`}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className={styles.itemNum}>{order.orderId || "LEGACY"}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDateTime(order.dateTime)}</span>
                        </div>
                        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                          <div style={{ fontWeight: "700", fontSize: "15px" }}>{order.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>📞 {order.phoneNumber}</div>
                          <div style={{ fontSize: "13px", marginTop: "4px" }}>📍 {order.address}</div>
                        </div>
                        <div>
                          <div className={styles.label} style={{ fontSize: "9px" }}>Items:</div>
                          <div className={styles.itemsList} style={{ marginTop: "4px" }}>
                            {order.items && order.items.length > 0 ? (
                              order.items.map((it, idx) => (
                                <div key={idx} className={styles.itemLabel}>• {it.itemName} <span className={styles.itemQty}>(x{it.quantity})</span></div>
                              ))
                            ) : <div className={styles.itemLabel}>• Product <span className={styles.itemQty}>(x{order.pieces || 1})</span></div>}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                          <div>
                            <div className={styles.label} style={{ fontSize: "9px" }}>Total Value:</div>
                            <div style={{ fontWeight: "850", fontSize: "15px", color: "var(--primary)" }}>Rs. {(order.totalPrice || order.price || 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className={styles.label} style={{ fontSize: "9px" }}>Cash Received:</div>
                            <span style={{ cursor: "pointer", display: "inline-block", marginTop: "2px" }} onClick={() => handleQuickStatusChange(order._id, { cashReceived: (order.cashReceived === "Yes" ? "No" : "Yes") })} className={`${styles.badge} ${order.cashReceived === "Yes" ? styles.badgeYes : styles.badgeNo}`}>{order.cashReceived === "Yes" ? "Yes" : "No"}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <div className={styles.field} style={{ flex: 1 }}>
                            <label className={styles.label} style={{ fontSize: "9px" }}>Status:</label>
                            <select className={styles.quickSelect} style={{ width: "100%", marginTop: "2px" }} value={order.deliveryStatus || order.status || "Pending"} onChange={(e) => handleQuickStatusChange(order._id, { deliveryStatus: e.target.value })}>
                              <option value="Pending">Pending</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Return">Returned</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                          {order.courier && (
                            <div style={{ flex: 1 }}>
                              <div className={styles.label} style={{ fontSize: "9px" }}>Courier:</div>
                              <div style={{ fontWeight: "600", fontSize: "12px", marginTop: "2px" }}>{order.courier}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>{order.trackingNumber || "No tracking"}</div>
                            </div>
                          )}
                        </div>
                        {order.note && <div style={{ fontSize: "12px", background: "rgba(255,255,255,0.02)", padding: "6px", borderRadius: "4px" }}><strong>Note:</strong> {order.note}</div>}
                        <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                          <button className={styles.printBtn} style={{ flex: 1 }} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                          <button className={styles.printBtn} style={{ flex: 1, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", border: "none" }} onClick={() => handlePrintBill(order)}>🧾 Print Bill</button>
                          <button className={styles.printBtn} style={{ flex: 1, background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", border: "none" }} onClick={() => handleDownloadInvoice(order)}>📄 Download PDF</button>
                          <button className={styles.editBtn} style={{ flex: 1 }} onClick={() => initiateOrderEdit(order)}>Edit</button>
                          <button className={styles.deleteBtn} style={{ flex: 1 }} onClick={() => handleOrderDelete(order._id)}>Delete</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* ── TAB 3: EXPENSES MANAGER ── */}
        {activeTab === "expenses" && effectiveView === "admin" && (
          <>
            <div className={styles.filtersRow}>
              <div className={styles.field} style={{ minWidth: "200px" }}>
                <select className={styles.select} value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value)}>
                  <option value="All">All Categories</option>
                  <option value="Stock">Stock Buying</option>
                  <option value="Courier">Courier Charges</option>
                  <option value="Marketing">Marketing / Ads</option>
                  <option value="Other">Other Expenses</option>
                </select>
              </div>
            </div>
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderInner}>
                  <span className={styles.sectionTitle} style={{ margin: 0 }}>Expenses Log</span>
                  <span className={styles.count}>{filteredExpenses.length} logs</span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className={styles.addBtn}
                    style={{
                      background: "linear-gradient(135deg, var(--accent), var(--error))",
                      margin: 0,
                      padding: "6px 12px",
                      fontSize: "13px"
                    }}
                    onClick={() => {
                      setShowExpenseForm((v) => !v);
                      setShowOrderForm(false);
                      setShowUserForm(false);
                      setShowProductForm(false);
                      setFormError("");
                      setEditingExpenseId(null);
                      setExpenseForm(EMPTY_EXPENSE_FORM);
                      if (!showExpenseForm) window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {showExpenseForm ? "✕ Close Form" : "+ Log Expense"}
                  </button>
                  <button
                    type="button"
                    className={styles.addBtn}
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      margin: 0,
                      padding: "6px 12px",
                      fontSize: "13px"
                    }}
                    onClick={handleDownloadExpensesReport}
                    disabled={expenses.length === 0}
                  >
                    📄 Download PDF Report
                  </button>
                </div>
              </div>
              <div className={`${styles.tableWrap} ${styles.desktopTableOnly}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Expense Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Cost (Rs.)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingExpenses ? (
                      <tr><td colSpan={5} className={styles.emptyCell}>Loading...</td></tr>
                    ) : filteredExpenses.length === 0 ? (
                      <tr><td colSpan={5} className={styles.emptyCell}>No expenses.</td></tr>
                    ) : (
                      filteredExpenses.map((expense) => {
                        const catClass = expense.category === "Stock" ? styles.catStock : expense.category === "Courier" ? styles.catCourier : expense.category === "Marketing" ? styles.catMarketing : styles.catOther;
                        return (
                          <tr key={expense._id}>
                            <td className={styles.dateCell}>{formatDateOnly(expense.dateTime)}</td>
                            <td><span className={`${styles.expenseCategory} ${catClass}`}>{expense.category}</span></td>
                            <td style={{ fontWeight: "500" }}>{expense.description}</td>
                            <td style={{ fontWeight: "700", color: "var(--error)" }}>Rs. {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button className={styles.editBtn} onClick={() => initiateExpenseEdit(expense)}>Edit</button>
                                <button className={styles.deleteBtn} onClick={() => handleExpenseDelete(expense._id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── TAB 4: USER ACCOUNTS ── */}
        {activeTab === "users" && effectiveView === "admin" && (
          <div className={styles.tableCard}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>User Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={4} className={styles.emptyCell}>Loading...</td></tr>
                  ) : users.map((u) => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: "600" }}>{u.name}</td>
                      <td style={{ fontFamily: "monospace", color: "var(--primary)", fontWeight: "600" }}>@{u.username}</td>
                      <td><span className={styles.badge}>{u.role}</span></td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button className={styles.editBtn} onClick={() => initiateUserEdit(u)}>Edit</button>
                          {u.username !== "admin" && <button className={styles.deleteBtn} onClick={() => handleUserDelete(u._id)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 5: INVENTORY MANAGER ── */}
        {activeTab === "inventory" && effectiveView === "admin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className={styles.packerSubTabs} style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`${styles.packerSubTab} ${inventorySubTab === "active" ? styles.packerSubTabActive : ""}`}
                onClick={() => {
                  setInventorySubTab("active");
                  setShowDefectiveForm(false);
                }}
              >
                🗃️ Active Products ({products.length})
              </button>
              <button
                type="button"
                className={`${styles.packerSubTab} ${inventorySubTab === "defectives" ? styles.packerSubTabActive : ""}`}
                onClick={() => {
                  setInventorySubTab("defectives");
                  setShowProductForm(false);
                }}
              >
                ⚠️ Defective / Faulty Logs ({defectives.length})
              </button>
            </div>

            {/* Sub-tab 1: Active Products */}
            {inventorySubTab === "active" && (
              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableHeaderInner}>
                    <span className={styles.sectionTitle} style={{ margin: 0 }}>Inventory / Product List</span>
                    <span className={styles.count}>{products.length} products total</span>
                  </div>
                  <button
                    className={styles.addBtn}
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      margin: 0,
                      padding: "6px 12px",
                      fontSize: "13px"
                    }}
                    onClick={() => {
                      setShowProductForm((v) => !v);
                      setShowOrderForm(false);
                      setShowExpenseForm(false);
                      setShowUserForm(false);
                      setFormError("");
                      setEditingProductId(null);
                      setProductForm(EMPTY_PRODUCT_FORM);
                      if (!showProductForm) window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {showProductForm ? "✕ Close Form" : "+ Add Product"}
                  </button>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Current Stock</th>
                        <th>Default Price</th>
                        <th>Warranty</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingProducts ? (
                        <tr><td colSpan={5} className={styles.emptyCell}>Loading inventory...</td></tr>
                      ) : products.length === 0 ? (
                        <tr><td colSpan={5} className={styles.emptyCell}>No products in inventory. Click "+ Add Product" to create one.</td></tr>
                      ) : (
                        products.map((prod) => (
                          <tr key={prod._id} className={prod.stock <= 0 ? styles.rowReturn : prod.stock <= 5 ? styles.rowPending : ""}>
                            <td style={{ fontWeight: "600" }}>{prod.name}</td>
                            <td style={{ fontWeight: "700", color: prod.stock <= 0 ? "var(--error)" : prod.stock <= 5 ? "var(--pending)" : "var(--approved)" }}>
                              {prod.stock} {prod.stock <= 0 ? " ⚠️ Out of Stock" : prod.stock <= 5 ? " ⚠️ Low Stock" : ""}
                            </td>
                            <td style={{ fontWeight: "700" }}>Rs. {Number(prod.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ fontWeight: "600", color: "var(--primary)" }}>{prod.warranty || "No Warranty"}</td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button className={styles.editBtn} onClick={() => initiateProductEdit(prod)}>Edit/Restock</button>
                                <button className={styles.deleteBtn} onClick={() => handleProductDelete(prod._id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Defective Logs */}
            {inventorySubTab === "defectives" && (
              <>
                {/* Form to log defectives */}
                {showDefectiveForm ? (
                  <div className={styles.formCard}>
                    <h2 className={styles.formTitle}>{editingDefectiveId ? "Edit Defective Log Details" : "Log Defective / Non-Working Item"}</h2>
                    {formError && <div className={styles.formError}>{formError}</div>}
                    <form onSubmit={handleDefectiveSubmit} className={styles.form}>
                      <div className={styles.formGrid}>
                        <div className={styles.field}>
                          <label className={styles.label}>Select Product</label>
                          <select
                            className={styles.select}
                            value={defectiveForm.productName}
                            onChange={(e) => setDefectiveForm({ ...defectiveForm, productName: e.target.value })}
                            required
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => (
                              <option key={p._id} value={p.name}>{p.name} (Stock: {p.stock})</option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Defective Quantity</label>
                          <input
                            className={styles.input}
                            type="number"
                            min="1"
                            value={defectiveForm.quantity}
                            onChange={(e) => setDefectiveForm({ ...defectiveForm, quantity: Number(e.target.value) })}
                            required
                          />
                        </div>
                        <div className={`${styles.field} ${styles.fieldWide}`}>
                          <label className={styles.label}>Reason / Fault Description</label>
                          <input
                            className={styles.input}
                            value={defectiveForm.reason}
                            onChange={(e) => setDefectiveForm({ ...defectiveForm, reason: e.target.value })}
                            placeholder="E.g. Left earbud not charging, cracked screen"
                            required
                          />
                        </div>
                      </div>
                      <div className={styles.formActions}>
                        <button type="button" className={styles.cancelBtn} onClick={() => { setShowDefectiveForm(false); setFormError(""); setDefectiveForm(EMPTY_DEFECTIVE_FORM); setEditingDefectiveId(null); }}>Cancel</button>
                        <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving…" : editingDefectiveId ? "Update Log" : "Log Defective"}</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className={styles.addBtn}
                      style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                      onClick={() => setShowDefectiveForm(true)}
                    >
                      ⚠️ Log Defective Item
                    </button>
                  </div>
                )}

                <div className={styles.tableCard}>
                  <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderInner}>
                      <span className={styles.sectionTitle} style={{ margin: 0 }}>Defective Log</span>
                      <span className={styles.count}>{defectives.length} records logged</span>
                    </div>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Date Logged</th>
                          <th>Product Name</th>
                          <th>Qty Damaged</th>
                          <th>Fault Reason</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingDefectives ? (
                          <tr><td colSpan={5} className={styles.emptyCell}>Loading defectives log...</td></tr>
                        ) : defectives.length === 0 ? (
                          <tr><td colSpan={5} className={styles.emptyCell}>No defective items logged. All stock is working properly.</td></tr>
                        ) : (
                          defectives.map((log) => (
                            <tr key={log._id} className={styles.rowReturn}>
                              <td className={styles.dateCell}>{formatDateTime(log.dateTime)}</td>
                              <td style={{ fontWeight: "600" }}>{log.productName}</td>
                              <td style={{ fontWeight: "700", color: "var(--error)" }}>{log.quantity} units</td>
                              <td style={{ fontStyle: "italic" }}>{log.reason}</td>
                              <td>
                                <div className={styles.actionButtons}>
                                  <button
                                    className={styles.editBtn}
                                    onClick={() => initiateDefectiveEdit(log)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className={styles.deleteBtn}
                                    style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "#fff", padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                                    onClick={() => handleDefectiveDelete(log._id, true)}
                                    title="Deletes the log and restores items back to active stock"
                                  >
                                    Restore Stock
                                  </button>
                                  <button
                                    className={styles.deleteBtn}
                                    style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", color: "#fff", padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                                    onClick={() => handleDefectiveDelete(log._id, false)}
                                    title="Permanently discards items and deletes the log without restoring stock"
                                  >
                                    Delete Log
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB 6: SETTLEMENTS ── */}
        {activeTab === "settlements" && effectiveView === "admin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {showSettlementForm ? (
              <div className={styles.formCard}>
                <h2 className={styles.formTitle}>{editingSettlementId ? "Edit Cash Settlement" : "Record Cash Settlement / Payout"}</h2>
                {formError && <div className={styles.formError}>{formError}</div>}
                <form onSubmit={handleSettlementSubmit} className={styles.form}>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Courier / Delivery Service</label>
                      <input
                        className={styles.input}
                        value={settlementForm.courier}
                        onChange={(e) => setSettlementForm({ ...settlementForm, courier: e.target.value })}
                        placeholder="E.g. Koombiyo, Pronto (Optional)"
                      />
                    </div>

                    <div ref={searchDropdownRef} className={`${styles.field} ${styles.fieldWide}`} style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label className={styles.label}>Search & Add Cash Pending Orders</label>
                        {showSearchDropdown && (
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--accent)",
                              fontSize: "12px",
                              cursor: "pointer",
                              padding: "0 0 4px 0",
                              fontWeight: "600"
                            }}
                            onClick={() => setShowSearchDropdown(false)}
                          >
                            ✕ Hide Dropdown
                          </button>
                        )}
                      </div>
                      <input
                        className={styles.input}
                        value={settlementSearchQuery}
                        onChange={(e) => {
                          setSettlementSearchQuery(e.target.value);
                          setShowSearchDropdown(true);
                        }}
                        onFocus={() => setShowSearchDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setShowSearchDropdown(false);
                          }
                        }}
                        placeholder="Type Order ID (e.g. ORD-1002) or Customer Name... (ESC to close)"
                      />
                      
                      {showSearchDropdown && (
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          background: "#ffffff",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                          zIndex: 50,
                          maxHeight: "200px",
                          overflowY: "auto",
                          marginTop: "4px"
                        }}>
                          {(() => {
                            const queryWords = (settlementSearchQuery || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
                            const matchedOrders = orders.filter(o => o.cashReceived === "No" && !settlementForm.orderIds.includes(o._id)).filter(o => {
                              if (queryWords.length === 0) return true;
                              const orderString = `
                                ${o.orderId || ""}
                                ${o.name || ""}
                                ${o.phoneNumber || ""}
                                ${o.address || ""}
                                ${o.courier || ""}
                                ${o.trackingNumber || ""}
                                ${(o.items || []).map(it => it.itemName || "").join(" ")}
                              `.toLowerCase();
                              return queryWords.every(word => orderString.includes(word));
                            });

                            if (matchedOrders.length === 0) {
                              return <div style={{ padding: "10px", fontSize: "14px", color: "#475569" }}>No pending cash orders found matching search.</div>;
                            }

                            return matchedOrders.map(o => (
                              <div
                                key={o._id}
                                onClick={() => {
                                  setSettlementForm(prev => ({
                                    ...prev,
                                    orderIds: [...prev.orderIds, o._id]
                                  }));
                                  setSettlementSearchQuery("");
                                  setShowSearchDropdown(false);
                                }}
                                style={{
                                  padding: "8px 12px",
                                  fontSize: "14px",
                                  borderBottom: "1px solid #f3f4f6",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  color: "#1e293b"
                                }}
                                onMouseEnter={(e) => e.target.style.background = "#f3f4f6"}
                                onMouseLeave={(e) => e.target.style.background = "transparent"}
                              >
                                <span style={{ color: "#1e293b" }}><strong>{o.orderId || "LEGACY"}</strong> - {o.name} ({o.courier || "No Courier"}) - {o.address}</span>
                                <span style={{ fontWeight: "700", color: "var(--approved)" }}>Rs. {(o.totalPrice || o.price || 0).toLocaleString()}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Orders List */}
                  <div style={{ marginTop: "16px" }}>
                    <label className={styles.label} style={{ display: "block", marginBottom: "8px" }}>Selected Orders ({settlementForm.orderIds.length})</label>
                    {settlementForm.orderIds.length === 0 ? (
                      <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0, padding: "10px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px" }}>No orders selected yet. Search above to add orders.</p>
                    ) : (
                      <div className={styles.tableWrap} style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "8px" }}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Customer Name</th>
                              <th>Amount</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {settlementForm.orderIds.map(id => {
                              const o = orders.find(ord => ord._id === id);
                              if (!o) return null;
                              return (
                                <tr key={o._id}>
                                  <td><strong>{o.orderId || "LEGACY"}</strong></td>
                                  <td>{o.name}</td>
                                  <td style={{ fontWeight: "700" }}>Rs. {(o.totalPrice || o.price || 0).toLocaleString()}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className={styles.deleteBtn}
                                      style={{ padding: "2px 6px", fontSize: "12px" }}
                                      onClick={() => setSettlementForm(prev => ({
                                        ...prev,
                                        orderIds: prev.orderIds.filter(val => val !== o._id)
                                      }))}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 8px 4px 8px", fontSize: "16px", fontWeight: "700" }}>
                          Total Cash-Out Value: Rs. {orders.filter(o => settlementForm.orderIds.includes(o._id)).reduce((sum, o) => sum + (o.totalPrice || o.price || 0), 0).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.formActions} style={{ marginTop: "20px" }}>
                    <button type="button" className={styles.cancelBtn} onClick={() => { setShowSettlementForm(false); setFormError(""); setSettlementForm(EMPTY_SETTLEMENT_FORM); setEditingSettlementId(null); setSettlementSearchQuery(""); setShowSearchDropdown(false); }}>Cancel</button>
                    <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving…" : "Save Settlement Sheet"}</button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className={styles.addBtn}
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                  onClick={() => { setShowSettlementForm(true); setEditingSettlementId(null); setSettlementForm(EMPTY_SETTLEMENT_FORM); }}
                >
                  🤝 Record Cash payout / Settlement
                </button>
              </div>
            )}

            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderInner}>
                  <span className={styles.sectionTitle} style={{ margin: 0 }}>Courier Settlements Log</span>
                  <span className={styles.count}>{settlements.length} payout sheets total</span>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Settlement Date</th>
                      <th>Courier Name</th>
                      <th>Orders Settled</th>
                      <th>Total Amount Cash-Out</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSettlements ? (
                      <tr><td colSpan={5} className={styles.emptyCell}>Loading payouts log...</td></tr>
                    ) : settlements.length === 0 ? (
                      <tr><td colSpan={5} className={styles.emptyCell}>No cash-outs logged yet.</td></tr>
                    ) : (
                      settlements.map((setObj) => (
                        <tr key={setObj._id}>
                          <td className={styles.dateCell}>{formatDateTime(setObj.dateTime)}</td>
                          <td style={{ fontWeight: "600" }}>{setObj.courier}</td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {setObj.orders && setObj.orders.map((o, index) => (
                                <span
                                  key={index}
                                  className={styles.badge}
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "11px",
                                    background: "#f1f5f9",
                                    color: "#334155",
                                    border: "1px solid #cbd5e1"
                                  }}
                                  title={o ? (o.name || "Order Details") : "Order Details"}
                                >
                                  {o ? (o.orderId || "ORD-LEGACY") : "ORD-DELETED"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ fontWeight: "700", color: "var(--approved)" }}>Rs. {Number(setObj.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>
                            <div className={styles.actionButtons}>
                              <button
                                className={styles.editBtn}
                                onClick={() => initiateSettlementEdit(setObj)}
                              >
                                Edit
                              </button>
                              <button
                                className={styles.deleteBtn}
                                style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                                onClick={() => handleSettlementDelete(setObj._id)}
                              >
                                Revert / Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PACKING STATION (Packer view) ── */}
        {effectiveView === "packer" && (
          <div>
            <div className={styles.packerHeader}>
              <div>
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>📦 Packing Station</h2>
                <p className={styles.subtitle} style={{ fontSize: "14px" }}>Verify items, print labels and dispatch.</p>
              </div>
            </div>
            <div className={styles.packerSubTabs}>
              <button type="button" className={`${styles.packerSubTab} ${packerSubTab === "pending" ? styles.packerSubTabActive : ""}`} onClick={() => setPackerSubTab("pending")}>⏳ Pending ({packerPendingOrders.length})</button>
              <button type="button" className={`${styles.packerSubTab} ${packerSubTab === "completed" ? styles.packerSubTabActive : ""}`} onClick={() => setPackerSubTab("completed")}>✅ Packed ({packerCompletedOrders.length})</button>
            </div>

            {packerSubTab === "pending" ? (
              packerPendingOrders.length === 0 ? <div className={styles.emptyCell}>🎉 All orders packed!</div> : (
                <div className={styles.packerBoard}>
                  {packerPendingOrders.map((order) => {
                    const orderChecks = packingChecks[order._id] || {};
                    const itemsCount = order.items?.length || 1;
                    const tickedCount = Object.keys(orderChecks).filter(k => orderChecks[k]).length;
                    const allItemsPacked = tickedCount === itemsCount;

                    return (
                      <div key={order._id} className={styles.packerCard}>
                        <div className={styles.packerCardHeader}>
                          <div><strong>{order.orderId || "LEGACY"}</strong></div>
                          <div style={{ fontWeight: "700", color: "var(--primary)", fontSize: "15px" }}>Rs. {(order.totalPrice || order.price || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div><strong>{order.name}</strong></div>
                          <div>📞 {order.phoneNumber}</div>
                          <div>📍 {order.address}</div>
                        </div>
                        <div className={styles.packingChecklist}>
                          {order.items?.map((it, idx) => (
                            <label key={idx} className={styles.packingCheckItem}>
                              <input type="checkbox" checked={!!orderChecks[idx]} onChange={() => handleTogglePackCheck(order._id, idx)} />
                              <span>{it.itemName} (x{it.quantity})</span>
                            </label>
                          )) || (
                            <label className={styles.packingCheckItem}>
                              <input type="checkbox" checked={!!orderChecks[0]} onChange={() => handleTogglePackCheck(order._id, 0)} />
                              <span>Product</span>
                            </label>
                          )}
                        </div>
                        <input className={styles.input} placeholder="Courier Service" value={packerCourier[order._id] || ""} onChange={(e) => setPackerCourier({ ...packerCourier, [order._id]: e.target.value })} />
                        <input className={styles.input} placeholder="Tracking Number" value={packerTracking[order._id] || ""} onChange={(e) => setPackerTracking({ ...packerTracking, [order._id]: e.target.value })} />
                        <button className={styles.printBtn} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                        <button className={styles.printBtn} style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", border: "none" }} onClick={() => handlePrintBill(order)}>🧾 Print Bill</button>
                        <button className={styles.packConfirmBtn} disabled={!allItemsPacked} onClick={() => handlePackerConfirmPacked(order)}>Confirm Packed</button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className={styles.packerBoard}>
                {packerCompletedOrders.map((order) => (
                  <div key={order._id} className={styles.packerCompletedCard}>
                    <div><strong>{order.orderId || "LEGACY"}</strong> - {order.name} <span style={{ color: "var(--primary)", fontWeight: "700", marginLeft: "10px" }}>(Rs. {(order.totalPrice || order.price || 0).toLocaleString()})</span></div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className={styles.printBtn} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                      <button className={styles.printBtn} style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", border: "none" }} onClick={() => handlePrintBill(order)}>🧾 Print Bill</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── PORTALED THERMAL CONTENT ── */}
      {printOrder && typeof document !== "undefined" && createPortal(
        <div id="print-container">
          {printMode === "label" ? (
            <div className="thermalLabelCard">
              <div className="thermalLabelCod">
                <span className="thermalLabelCodLeft">C.O.D</span>
                <span className="thermalLabelCodRight" style={{ textAlign: "left", display: "block", width: "100%" }}>
                  Rs. {(printOrder.totalPrice || printOrder.price || 0).toLocaleString()}
                </span>
              </div>
              <div className="thermalLabelContentStack">
                {/* FROM Section */}
                <div className="thermalLabelRowBlock thermalLabelFromBlock">
                  <span className="thermalLabelTag">From:</span>
                  <span className="thermalLabelLineInline">Geolex Store, No 52, New Shopping Complex, Imaduwa.</span>
                  <span className="thermalLabelPhoneInline">0740136448 / 0776171360</span>
                </div>
                {/* TO Section */}
                <div className="thermalLabelRowBlock">
                  <span className="thermalLabelTag">To:</span>
                  <span className="thermalLabelLineInline" style={{ fontWeight: "bold" }}>{printOrder.name}, </span>
                  <span className="thermalLabelLineInline">{printOrder.address}</span>
                  <div style={{ marginTop: "2px" }}>
                    <span className="thermalLabelTag">Tel:</span>
                    <span className="thermalLabelPhoneInline" style={{ fontSize: "12pt", marginLeft: "0" }}>{printOrder.phoneNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="thermalBillCard">
              <div style={{ textAlign: "center", marginBottom: "10px" }}>
                <h2 style={{ margin: "0 0 2px 0", fontSize: "14pt", fontWeight: "bold", textTransform: "uppercase" }}>GEOLEX STORE</h2>
                <p style={{ margin: "0", fontSize: "9pt", lineHeight: "1.2" }}>No 52, New Shopping Complex, Imaduwa.</p>
                <p style={{ margin: "0", fontSize: "9pt", lineHeight: "1.2" }}>Tel: 0740136448 / 0776171360</p>
              </div>

              <div className="thermalBillDivider"></div>

              <div style={{ fontSize: "9pt", margin: "8px 0" }}>
                <div><strong>Bill Date:</strong> {new Date(printOrder.dateTime || Date.now()).toLocaleString()}</div>
                <div><strong>Order ID:</strong> {printOrder.orderId || "ORD-LEGACY"}</div>
                <div><strong>Customer:</strong> {printOrder.name}</div>
                {printOrder.phoneNumber && <div><strong>Tel:</strong> {printOrder.phoneNumber}</div>}
              </div>

              <div className="thermalBillDivider"></div>

              <table style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0", fontSize: "9.5pt" }}>
                <thead>
                  <tr style={{ borderBottom: "1px dashed #000" }}>
                    <th style={{ textAlign: "left", padding: "4px 0" }}>Item Description</th>
                    <th style={{ textAlign: "center", padding: "4px 0", width: "40px" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "4px 0", width: "80px" }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(printOrder.items && printOrder.items.length > 0 ? printOrder.items : [{
                    itemName: "Product",
                    quantity: printOrder.pieces || 1,
                    price: printOrder.price || 0
                  }]).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px dashed #ccc" }}>
                      <td style={{ padding: "4px 0", verticalAlign: "top" }}>
                        <div>{item.itemName}</div>
                        {products.find(p => p.name === item.itemName)?.warranty && (
                          <div style={{ fontSize: "8pt", fontStyle: "italic", color: "#666" }}>
                            Warranty: {products.find(p => p.name === item.itemName).warranty}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "4px 0", textAlign: "center", verticalAlign: "top" }}>{item.quantity}</td>
                      <td style={{ padding: "4px 0", textAlign: "right", verticalAlign: "top" }}>
                        Rs. {Number(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="thermalBillDivider"></div>

              <div style={{ margin: "8px 0", fontSize: "10pt" }}>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                  <span>Subtotal:</span>
                  <span>Rs. {(printOrder.totalPrice || printOrder.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0", fontSize: "12pt", fontWeight: "bold" }}>
                  <span>NET TOTAL:</span>
                  <span>Rs. {(printOrder.totalPrice || printOrder.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {printOrder.note && (
                <div style={{ fontSize: "8pt", fontStyle: "italic", margin: "8px 0" }}>
                  Note: {printOrder.note}
                </div>
              )}

              <div className="thermalBillDivider"></div>

              <div style={{ textAlign: "center", marginTop: "15px", fontSize: "9pt" }}>
                <div style={{ fontWeight: "bold" }}>Thank you for shopping with us!</div>
                <div>Come Again!</div>
                <div style={{ fontSize: "7pt", marginTop: "5px", color: "#666" }}>System Generated Bill</div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}