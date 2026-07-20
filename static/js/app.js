// CONFIGURAÇÕES GERAIS
const API_BASE = ""; // URL relativa (mesmo host)
let currentCupId = null;
let currentUser = null;
let activeScreen = "screen-scan";
let activeLocationFilter = "all";
let pingInterval = null;
let uploadedAvatarDataUrl = null;

// CHAT ATIVO
let activeChatMatchId = null;
let chatInterval = null;

// COMUNICADO GERAL
let lastSeenAnnouncementTime = 0;
let currentAnnouncementTime = 0;

// CANVASES DE BOLHAS
let dashboardCanvas = null;
let dashboardPhysics = null;

let telaoCanvas = null;
let telaoPhysics = null;

// MAPA DE EMOJIS POR AVATAR ID
const AVATAR_EMOJIS = {
    "girl1": "👩‍🎤",
    "girl2": "👩‍🚀",
    "boy1": "👨‍🎤",
    "boy2": "👨‍🚀",
    "boy3": "👾"
};

// CORES DE NEON POR AVATAR/LOCALIZAÇÃO
const NEON_COLORS = {
    "Pista": "#ff2a74",   // Rosa
    "Bar": "#05f9e2",     // Ciano
    "VIP": "#8a2be2",     // Roxo
    "Palco": "#ff6b35"    // Laranja
};

const VIBE_COLORS = {
    "Amigos": "#8a2be2",    // Roxo/Purple
    "Paquerar": "#ff2a74",   // Pink
    "Dançar": "#05f9e2",     // Ciano/Cyan
    "Resenhar": "#f8c531"    // Amarelo/Yellow
};

// ==========================================
// 1. GERENCIAMENTO DE ROTAS & INICIALIZAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventHandlers();
});

function initApp() {
    // 1. Fechar simulador se clicar no botão
    const toggleSimBtn = document.getElementById("toggle-sim-btn");
    const simPanel = document.getElementById("sim-control-panel");
    if (toggleSimBtn && simPanel) {
        toggleSimBtn.addEventListener("click", () => {
            simPanel.classList.toggle("collapsed");
            toggleSimBtn.innerText = simPanel.classList.contains("collapsed") ? "Abrir Painel" : "Recolher";
        });
    }

    // 2. Tratar URLs no carregamento (Router SPA)
    handleUrlRouting();

    // 3. Monitorar mudanças de URL (caso o usuário digite/volte)
    window.addEventListener("popstate", handleUrlRouting);
}

function handleUrlRouting() {
    const path = window.location.pathname;
    
    // Rota: Telão da Balada
    if (path === "/telao") {
        const simPanel = document.getElementById("sim-control-panel");
        if (simPanel) simPanel.style.display = "none"; // Esconde painel no telão
        changeScreen("screen-telao");
        startTelaoView();
        return;
    }
    
    // Rota: Validador do Barman
    if (path === "/barman") {
        changeScreen("screen-barman");
        return;
    }
    
    // Rota: Copo Específico (NFC TAP)
    const copoMatch = path.match(/\/copo\/([a-zA-Z0-9_-]+)/);
    if (copoMatch) {
        const cupId = copoMatch[1];
        loginWithCup(cupId);
        return;
    }

    // Default: Se já tem cadastro salvo no navegador, entra direto no app
    const localProfile = localStorage.getItem("copo_social_my_profile");
    if (localProfile) {
        try {
            const profile = JSON.parse(localProfile);
            if (profile && profile.id) {
                loginWithCup(profile.id);
                return;
            }
        } catch (e) {
            console.error("Erro ao carregar perfil salvo:", e);
        }
    }

    // Default: Tela de Scan
    changeScreen("screen-scan");
}

// Mudar de tela na SPA
function changeScreen(screenId) {
    if (screenId !== "screen-dashboard" && screenId !== "screen-matches-list" && screenId !== "screen-mural") {
        stopPingLoop();
    }
    if (screenId !== "screen-chat") {
        stopChatLoop();
    }
    if (screenId !== "screen-dashboard" && dashboardPhysics) {
        dashboardPhysics.stop();
        dashboardPhysics = null;
    }
    if (screenId !== "screen-telao" && telaoPhysics) {
        telaoPhysics.stop();
        telaoPhysics = null;
        stopTelaoLoop();
    }

    // Remover active de todas
    document.querySelectorAll(".screen, .screen-full").forEach(s => {
        s.classList.remove("active");
    });

    // Adicionar active na tela selecionada
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add("active");
        activeScreen = screenId;
    }

    // Scroll para o topo
    window.scrollTo(0, 0);
}

// Configurar ouvintes de eventos HTML
function setupEventHandlers() {
    // Conectar sem copo (Digital)
    const btnEnterDigital = document.getElementById("btn-enter-digital");
    if (btnEnterDigital) {
        btnEnterDigital.addEventListener("click", () => {
            const randomId = "digital_" + Math.floor(100000 + Math.random() * 900000);
            simulateNfcTap(randomId);
        });
    }

    // Conectar manualmente
    const manualScanBtn = document.getElementById("manual-scan-btn");
    if (manualScanBtn) {
        manualScanBtn.addEventListener("click", () => {
            const inputId = document.getElementById("manual-cup-id").value.trim();
            if (inputId) {
                simulateNfcTap(inputId);
            }
        });
    }

    // Submissão do Formulário de Registro
    document.getElementById("register-form").addEventListener("submit", (e) => {
        e.preventDefault();
        registerUser();
    });

    // Botões de Navegação do Footer (Dashboard / SPA Tabs)
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tab = e.currentTarget.getAttribute("data-tab");
            
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            
            // Ativar botões correspondentes ao mesmo tab em todas as nav-footers
            document.querySelectorAll(`.nav-btn[data-tab="${tab}"]`).forEach(b => b.classList.add("active"));

            if (tab === "pista") {
                changeScreen("screen-dashboard");
                loadDashboardData();
            } else if (tab === "mural") {
                changeScreen("screen-mural");
                loadMuralMessages();
            } else if (tab === "matches") {
                changeScreen("screen-matches-list");
                loadMatchesList();
            } else if (tab === "loc") {
                changeScreen("screen-change-location");
                setupLocationChangeScreen();
            }
        });
    });

    // Toggle de visualização (Bolhas vs Grade)
    const btnViewBubbles = document.getElementById("btn-view-bubbles");
    const btnViewGrid = document.getElementById("btn-view-grid");
    const bubblesView = document.getElementById("bubbles-arena-view");
    const gridView = document.getElementById("grid-view");

    btnViewBubbles.addEventListener("click", () => {
        btnViewBubbles.classList.add("active");
        btnViewGrid.classList.remove("active");
        bubblesView.classList.remove("hidden");
        gridView.classList.add("hidden");
        // Reiniciar animação de bolhas se necessário
        if (dashboardPhysics) {
            dashboardPhysics.resize();
        }
    });

    btnViewGrid.addEventListener("click", () => {
        btnViewGrid.classList.add("active");
        btnViewBubbles.classList.remove("active");
        gridView.classList.remove("hidden");
        bubblesView.classList.add("hidden");
        renderGridView();
    });

    // Filtros de Localização
    document.querySelectorAll(".loc-filter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".loc-filter-btn").forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            activeLocationFilter = e.currentTarget.getAttribute("data-loc");
            
            // Recarregar listas e bolhas de acordo com o filtro
            if (activeScreen === "screen-dashboard") {
                if (btnViewGrid.classList.contains("active")) {
                    renderGridView();
                } else if (dashboardPhysics) {
                    dashboardPhysics.applyFilter(activeLocationFilter);
                }
            }
        });
    });

    // Fechar modal de detalhes do perfil
    document.querySelector(".close-modal-btn").addEventListener("click", () => {
        document.getElementById("profile-detail-modal").classList.remove("active");
    });

    // Ação de Brindar no Modal de Detalhes
    document.getElementById("btn-send-cheers").addEventListener("click", () => {
        const targetId = document.getElementById("btn-send-cheers").getAttribute("data-target-id");
        sendCheers(targetId);
    });

    // Enviar mensagem no chat
    document.getElementById("chat-send-btn").addEventListener("click", sendMessage);
    document.getElementById("chat-input-field").addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    // Botões rápidos de mensagem no chat (presets)
    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const text = e.target.innerText;
            document.getElementById("chat-input-field").value = text;
            sendMessage();
        });
    });

    // Botões de voltar e fechar
    document.getElementById("chat-back-btn").addEventListener("click", () => {
        changeScreen("screen-matches-list");
        loadMatchesList();
    });

    document.getElementById("match-close-btn").addEventListener("click", () => {
        document.getElementById("match-celebration").classList.add("hidden");
    });

    document.getElementById("match-chat-btn").addEventListener("click", () => {
        const matchId = document.getElementById("match-chat-btn").getAttribute("data-match-id");
        document.getElementById("match-celebration").classList.add("hidden");
        openChatScreen(matchId);
    });

    // Cupom no bar (pelo chat)
    document.getElementById("chat-show-voucher-btn").addEventListener("click", () => {
        alert(`🍹 Cupom de Desconto Ativo!\n\nCódigo do Match: ${activeChatMatchId}\n\nApresente este código ao Barman para validar seu Double Drink!`);
    });

    // Fechar notificação push
    document.getElementById("notif-close-btn").addEventListener("click", () => {
        document.getElementById("app-notification").classList.add("hidden");
    });

    // Botão do Barman validar
    document.getElementById("btn-barman-validate").addEventListener("click", barmanValidateMatch);
    document.getElementById("btn-barman-confirm-redeemed").addEventListener("click", () => {
        document.getElementById("barman-result").classList.add("hidden");
        document.getElementById("barman-match-code").value = "";
        alert("Drink validado e entregue com sucesso!");
    });

    // Botão de alterar localização de fato
    document.querySelectorAll(".loc-opt-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const loc = e.currentTarget.getAttribute("data-location");
            updateLocationOnServer(loc);
        });
    });
    
    document.getElementById("btn-cancel-location").addEventListener("click", () => {
        changeScreen("screen-dashboard");
        loadDashboardData();
    });

    // Evento de Upload de Foto Própria
    const avatarFileInput = document.getElementById("reg-avatar-file");
    if (avatarFileInput) {
        avatarFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    
                    const maxDim = 120;
                    let w = img.width;
                    let h = img.height;
                    
                    if (w > h) {
                        if (w > maxDim) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        }
                    } else {
                        if (h > maxDim) {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    uploadedAvatarDataUrl = canvas.toDataURL("image/jpeg", 0.7);
                    
                    document.getElementById("img-crop-preview").src = uploadedAvatarDataUrl;
                    document.getElementById("user-avatar-crop-preview").classList.remove("hidden");
                    
                    document.querySelectorAll("input[name='reg-avatar']").forEach(radio => {
                        radio.checked = false;
                    });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    const removeBtn = document.getElementById("btn-remove-uploaded-img");
    if (removeBtn) {
        removeBtn.addEventListener("click", () => {
            uploadedAvatarDataUrl = null;
            document.getElementById("reg-avatar-file").value = "";
            document.getElementById("user-avatar-crop-preview").classList.add("hidden");
            document.getElementById("img-crop-preview").src = "";
            
            const firstRadio = document.querySelector("input[name='reg-avatar']");
            if (firstRadio) firstRadio.checked = true;
        });
    }

    // Botão de Enviar Mural
    document.getElementById("btn-send-mural").addEventListener("click", sendMuralMessage);
    document.getElementById("mural-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMuralMessage();
    });

    // Sub-abas do Mural (Recados vs Galeria)
    const btnMuralRecados = document.getElementById("btn-mural-tab-recados");
    const btnMuralGaleria = document.getElementById("btn-mural-tab-galeria");
    const viewMuralRecados = document.getElementById("mural-view-recados");
    const viewMuralGaleria = document.getElementById("mural-view-galeria");

    if (btnMuralRecados && btnMuralGaleria) {
        btnMuralRecados.addEventListener("click", () => {
            btnMuralRecados.classList.add("active");
            btnMuralGaleria.classList.remove("active");
            viewMuralRecados.classList.remove("hidden");
            viewMuralGaleria.classList.add("hidden");
            loadMuralMessages();
        });

        btnMuralGaleria.addEventListener("click", () => {
            btnMuralGaleria.classList.add("active");
            btnMuralRecados.classList.remove("active");
            viewMuralGaleria.classList.remove("hidden");
            viewMuralRecados.classList.add("hidden");
            loadGalleryPhotos();
        });
    }

    // Uploader da Galeria
    const galleryFileInput = document.getElementById("gallery-photo-file");
    if (galleryFileInput) {
        galleryFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    
                    const maxDim = 320; // Otimizado para Galeria
                    let w = img.width;
                    let h = img.height;
                    
                    if (w > h) {
                        if (w > maxDim) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        }
                    } else {
                        if (h > maxDim) {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
                    
                    uploadGalleryPhoto(compressedBase64);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Sub-abas do Painel de Moderação
    const btnModRecados = document.getElementById("btn-mod-tab-recados");
    const btnModGaleria = document.getElementById("btn-mod-tab-galeria");
    const viewModRecados = document.getElementById("mod-view-recados");
    const viewModGaleria = document.getElementById("mod-view-galeria");

    if (btnModRecados && btnModGaleria) {
        btnModRecados.addEventListener("click", () => {
            btnModRecados.classList.add("active");
            btnModGaleria.classList.remove("active");
            viewModRecados.classList.remove("hidden");
            viewModGaleria.classList.add("hidden");
            loadModerationMessages();
        });

        btnModGaleria.addEventListener("click", () => {
            btnModGaleria.classList.add("active");
            btnModRecados.classList.remove("active");
            viewModGaleria.classList.remove("hidden");
            viewModRecados.classList.add("hidden");
            loadModerationPhotos();
        });
    }

    // Botão de Atualizar Moderação
    document.getElementById("btn-refresh-moderation").addEventListener("click", loadModerationMessages);
    const btnRefreshModPhotos = document.getElementById("btn-refresh-mod-photos");
    if (btnRefreshModPhotos) {
        btnRefreshModPhotos.addEventListener("click", loadModerationPhotos);
    }

    // Botões Admin do Simulador
    const simTriggerPromoBtn = document.getElementById("sim-trigger-promo-btn");
    if (simTriggerPromoBtn) simTriggerPromoBtn.addEventListener("click", simTriggerPromo);
    
    const simDrawPrizeBtn = document.getElementById("sim-draw-prize-btn");
    if (simDrawPrizeBtn) simDrawPrizeBtn.addEventListener("click", simDrawPrize);

    // Botões do Painel de Moderação (Comunicados)
    const btnModSendAnnounce = document.getElementById("btn-mod-send-announcement");
    const btnModClearAnnounce = document.getElementById("btn-mod-clear-announcement");
    if (btnModSendAnnounce && btnModClearAnnounce) {
        btnModSendAnnounce.addEventListener("click", modSendAnnouncement);
        btnModClearAnnounce.addEventListener("click", modClearAnnouncement);
    }

    // Fechar Modais
    const btnClosePromo = document.getElementById("btn-close-promo");
    if (btnClosePromo) {
        btnClosePromo.addEventListener("click", () => {
            document.getElementById("promo-modal").classList.add("hidden");
        });
    }
    
    const btnClosePrize = document.getElementById("btn-close-prize");
    if (btnClosePrize) {
        btnClosePrize.addEventListener("click", () => {
            document.getElementById("prize-modal").classList.add("hidden");
        });
    }
    
    const btnCloseAnnounce = document.getElementById("btn-close-announcement");
    if (btnCloseAnnounce) {
        btnCloseAnnounce.addEventListener("click", () => {
            lastSeenAnnouncementTime = currentAnnouncementTime;
            document.getElementById("announcement-modal").classList.add("hidden");
        });
    }

    // Controles do simulador (API direto)
    const simToggleEventBtn = document.getElementById("sim-toggle-event-btn");
    if (simToggleEventBtn) simToggleEventBtn.addEventListener("click", toggleEventStatus);
    
    const simResetBtn = document.getElementById("sim-reset-btn");
    if (simResetBtn) simResetBtn.addEventListener("click", resetDatabase);
}


// ==========================================
// 2. SIMULADOR E CHAMADAS DA API (BACKEND)
// ==========================================

// Simular aproximação NFC (muda rota e URL)
function simulateNfcTap(cupId) {
    // Muda a URL no histórico sem recarregar a página
    window.history.pushState({ cupId }, `Copo Social - ${cupId}`, `/copo/${cupId}`);
    loginWithCup(cupId);
}

// Logar / Consultar Copo
async function loginWithCup(cupId) {
    currentCupId = cupId;
    
    try {
        // Primeiro checar se o evento está ativo
        const configRes = await fetch(`${API_BASE}/api/config`);
        const config = await configRes.json();
        
        if (!config.event_active) {
            // Se o evento acabou, puxamos matches do localStorage para visualização local
            currentUser = { id: cupId, name: "Você" };
            changeScreen("screen-event-ended");
            loadEndedScreenMatches();
            return;
        }

        // Buscar dados de todos os usuários para checar se o cupId já está cadastrado
        const usersRes = await fetch(`${API_BASE}/api/users`);
        const users = await usersRes.json();
        const user = users.find(u => u.id === cupId);

        if (user) {
            currentUser = user;
            changeScreen("screen-dashboard");
            loadDashboardData();
            startPingLoop();
        } else {
            // Não cadastrado -> Onboarding
            currentUser = null;
            changeScreen("screen-register");
            // Auto-preencher campo de ID se necessário
            const manualInput = document.getElementById("manual-cup-id");
            if (manualInput) {
                manualInput.value = cupId;
            }

            // Auto-preenche o formulário se já existia perfil local anterior (ex: se o servidor reiniciou)
            const savedProfile = localStorage.getItem("copo_social_my_profile");
            if (savedProfile) {
                try {
                    const profile = JSON.parse(savedProfile);
                    prefillRegisterForm(profile);
                } catch (e) {
                    console.error("Erro ao pré-preencher formulário:", e);
                }
            }
        }
    } catch (e) {
        console.error("Erro ao comunicar com o servidor:", e);
        alert("Erro de conexão com o servidor do Copo Social.");
    }
}

function prefillRegisterForm(profile) {
    if (!profile) return;
    if (document.getElementById("reg-name")) document.getElementById("reg-name").value = profile.name || "";
    if (document.getElementById("reg-age")) document.getElementById("reg-age").value = profile.age || "";
    if (document.getElementById("reg-location")) document.getElementById("reg-location").value = profile.location || "Pista";
    if (document.getElementById("reg-vibe")) document.getElementById("reg-vibe").value = profile.vibe || "Amigos";
    if (document.getElementById("reg-clothes")) document.getElementById("reg-clothes").value = profile.clothes || "";
    if (document.getElementById("reg-instagram")) document.getElementById("reg-instagram").value = profile.instagram || "";
}

// Enviar Registro
async function registerUser() {
    const name = document.getElementById("reg-name").value.trim();
    const age = document.getElementById("reg-age").value;
    const location = document.getElementById("reg-location").value;
    const clothes = document.getElementById("reg-clothes").value.trim();
    const instagram = document.getElementById("reg-instagram").value.trim();
    
    let avatar = "";
    if (uploadedAvatarDataUrl) {
        avatar = uploadedAvatarDataUrl;
    } else {
        const avatarEls = document.getElementsByName("reg-avatar");
        for (let el of avatarEls) {
            if (el.checked) {
                avatar = el.value;
                break;
            }
        }
    }

    const vibe = document.getElementById("reg-vibe").value;

    const payload = {
        cup_id: currentCupId,
        name,
        age,
        location,
        vibe,
        clothes,
        instagram,
        avatar
    };

    try {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.user;
            uploadedAvatarDataUrl = null; // Limpa para o próximo registro
            document.getElementById("reg-avatar-file").value = "";
            document.getElementById("user-avatar-crop-preview").classList.add("hidden");
            
            changeScreen("screen-dashboard");
            loadDashboardData();
            startPingLoop();
            
            saveLocalProfile(currentUser);
        } else {
            alert("Erro ao realizar cadastro: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("Falha de rede ao se cadastrar.");
    }
}

// Alterar Localização
async function updateLocationOnServer(loc) {
    try {
        const res = await fetch(`${API_BASE}/api/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cup_id: currentCupId, location: loc })
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser.location = loc;
            changeScreen("screen-dashboard");
            loadDashboardData();
        }
    } catch (e) {
        console.error(e);
    }
}

// Mudar localização (ajusta botões ativos da UI)
function setupLocationChangeScreen() {
    document.querySelectorAll(".loc-opt-btn").forEach(btn => {
        if (btn.getAttribute("data-location") === currentUser.location) {
            btn.style.borderColor = "var(--neon-cyan)";
            btn.style.background = "rgba(5, 249, 226, 0.1)";
        } else {
            btn.style.borderColor = "rgba(255,255,255,0.08)";
            btn.style.background = "var(--card-bg)";
        }
    });
}

// PING / LONG POLLING DE NOTIFICAÇÕES (Brindes e Matches)
function startPingLoop() {
    stopPingLoop();
    pingServer(); // Primeira imediata
    pingInterval = setInterval(pingServer, 3000);
}

function stopPingLoop() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

async function pingServer() {
    if (!currentCupId) return;

    try {
        const res = await fetch(`${API_BASE}/api/ping?cup_id=${currentCupId}`);
        const data = await res.json();

        // 1. Checar se o evento acabou
        if (!data.event_active) {
            stopPingLoop();
            changeScreen("screen-event-ended");
            loadEndedScreenMatches();
            return;
        }

        // 2. Checar brindes recebidos (Push Notification no App)
        if (data.incoming_cheers && data.incoming_cheers.length > 0) {
            const sender = data.incoming_cheers[0]; // Pega o primeiro pendente
            showAppNotification(sender);
        } else {
            document.getElementById("app-notification").classList.add("hidden");
        }

        // 3. Atualizar estatísticas e notificações internas
        // (Salva os matches em localStorage para persistência pós-evento)
        if (data.matches) {
            saveLocalMatches(data.matches);
        }

        // 4. Checar promoção relâmpago ativa
        if (data.active_promo) {
            const now = Math.floor(Date.now() / 1000);
            const remaining = data.active_promo.end_time - now;
            if (remaining > 0) {
                document.getElementById("promo-modal-text").innerText = data.active_promo.text;
                const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
                const seconds = (remaining % 60).toString().padStart(2, '0');
                document.getElementById("promo-modal-timer").innerText = `${minutes}:${seconds}`;
                document.getElementById("promo-modal").classList.remove("hidden");
            } else {
                document.getElementById("promo-modal").classList.add("hidden");
            }
        } else {
            document.getElementById("promo-modal").classList.add("hidden");
        }

        // 5. Checar sorteio premiado ganho
        if (data.prize_winner) {
            document.getElementById("prize-partner-name").innerText = data.prize_winner.partner;
            document.getElementById("prize-voucher-code").innerText = data.prize_winner.voucher;
            document.getElementById("prize-modal").classList.remove("hidden");
        } else {
            document.getElementById("prize-modal").classList.add("hidden");
        }

        // 6. Checar comunicado geral
        if (data.announcement) {
            currentAnnouncementTime = data.announcement.timestamp;
            if (data.announcement.timestamp > lastSeenAnnouncementTime) {
                document.getElementById("announcement-modal-text").innerText = data.announcement.text;
                document.getElementById("announcement-modal").classList.remove("hidden");
            } else {
                document.getElementById("announcement-modal").classList.add("hidden");
            }
        } else {
            document.getElementById("announcement-modal").classList.add("hidden");
        }

        // 7. Atualizar feed ao vivo na Pista
        if (activeScreen === "screen-dashboard") {
            loadPistaFeed();
        }
    } catch (e) {
        console.error("Ping error:", e);
    }
}

// Mostrar notificação push dentro do app
function showAppNotification(sender) {
    const notif = document.getElementById("app-notification");
    const title = document.getElementById("notif-title");
    const desc = document.getElementById("notif-desc");
    const actionBtn = document.getElementById("notif-action-btn");

    title.innerText = `${sender.name} brindou com você! 🥂`;
    desc.innerText = `Como está vestindo: ${sender.clothes}`;
    
    // Ao clicar em brindar de volta, confirma o match!
    actionBtn.onclick = () => {
        notif.classList.add("hidden");
        sendCheers(sender.id);
    };

    notif.classList.remove("hidden");
}

// Enviar Brinde (🥂 Cheers / Like)
async function sendCheers(targetCupId) {
    try {
        const res = await fetch(`${API_BASE}/api/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from_cup_id: currentCupId, to_cup_id: targetCupId })
        });
        const data = await res.json();

        // Fecha modal se aberto
        document.getElementById("profile-detail-modal").classList.remove("active");

        if (data.success) {
            if (data.match) {
                // Deu Match! Tim-Tim!
                triggerMatchCelebration(targetCupId, data.match_id);
            } else {
                alert("Brinde enviado! 🥂 Se a pessoa brindar de volta, vocês abrem o chat!");
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// Disparar tela de match animada
async function triggerMatchCelebration(otherId, matchId) {
    // Pegar detalhes do outro usuário
    try {
        const usersRes = await fetch(`${API_BASE}/api/users`);
        const users = await usersRes.json();
        const otherUser = users.find(u => u.id === otherId);

        if (!otherUser) return;

        // Configurar imagens/emojis
        document.getElementById("match-avatar-me").innerHTML = `<img src="${currentUser.avatar}" alt="Você">`;
        document.getElementById("match-avatar-other").innerHTML = `<img src="${otherUser.avatar}" alt="${otherUser.name}">`;
        document.getElementById("match-name-other").innerText = otherUser.name;
        
        // Configurar botão de chat do match
        document.getElementById("match-chat-btn").setAttribute("data-match-id", matchId);

        // Mostrar celebração
        document.getElementById("match-celebration").classList.remove("hidden");

        // Salvar localmente o match para quando o evento acabar
        saveSingleLocalMatch(otherUser);
    } catch (e) {
        console.error(e);
    }
}


// ==========================================
// 3. PISTA DE BOLHAS (ENGINE VISUAL EM CANVAS)
// ==========================================

function loadDashboardData() {
    // Carregar informações do header
    const nameEl = document.querySelector("#header-user-status .user-name");
    const locBadge = document.getElementById("current-location-badge");

    nameEl.innerText = currentUser ? currentUser.name : "Carregando...";
    locBadge.innerText = `📍 ${currentUser ? currentUser.location : "Pista"}`;
    locBadge.className = "user-loc-badge " + (currentUser && currentUser.location === "VIP" ? "pink" : "");

    // Inicializar Canvas de Bolhas
    setupDashboardBubblesCanvas();

    // Carregar Feed ao vivo
    loadPistaFeed();
}

// Feed ao vivo na Pista — mistura fotos e recados como um Instagram
let pistaFeedInterval = null;
let pistaFeedLastCount = 0;

async function loadPistaFeed() {
    try {
        const [photosRes, muralRes] = await Promise.all([
            fetch(`${API_BASE}/api/gallery`),
            fetch(`${API_BASE}/api/mural`)
        ]);
        const photos = await photosRes.json();
        const messages = await muralRes.json();

        // Mistura e ordena por timestamp (mais recentes primeiro)
        const feedItems = [
            ...photos.map(p => ({ ...p, type: "photo" })),
            ...messages.map(m => ({ ...m, type: "message" }))
        ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);

        const container = document.getElementById("pista-feed-container");
        if (!container) return;

        if (feedItems.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted); font-size: 14px;">Nenhuma foto ou recado ainda. Seja o primeiro! 🎉</div>`;
            return;
        }

        // Só atualiza DOM se houve mudança
        if (feedItems.length === pistaFeedLastCount) return;
        pistaFeedLastCount = feedItems.length;

        container.innerHTML = feedItems.map(item => {
            const timeAgo = formatTimeAgo(item.timestamp);
            if (item.type === "photo") {
                const alreadyCheered = item.cheers_by && currentCupId && item.cheers_by.includes(currentCupId);
                return `
                <div style="background: var(--card-bg); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden;">
                    <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px 8px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple)); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">📸</div>
                        <div>
                            <p style="font-weight: 700; font-size: 14px;">${item.sender_name}</p>
                            <p style="font-size: 11px; color: var(--text-muted);">${timeAgo}</p>
                        </div>
                    </div>
                    <img src="${item.image}" alt="Foto da festa" style="width: 100%; max-height: 340px; object-fit: cover; display: block;">
                    <div style="padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
                        <button onclick="cheerPhoto('${item.id}', this)" ${alreadyCheered ? 'disabled' : ''} style="
                            background: ${alreadyCheered ? 'rgba(255,42,116,0.15)' : 'rgba(255,42,116,0.08)'};
                            border: 1px solid ${alreadyCheered ? 'rgba(255,42,116,0.5)' : 'rgba(255,42,116,0.2)'};
                            border-radius: 20px; padding: 6px 14px;
                            color: ${alreadyCheered ? 'var(--neon-pink)' : 'rgba(255,255,255,0.6)'};
                            font-size: 13px; font-weight: 700; cursor: ${alreadyCheered ? 'default' : 'pointer'};
                            display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
                            🥂 <span class="cheers-count-${item.id}">${item.cheers_count || 0}</span>
                        </button>
                        <span style="font-size: 11px; color: var(--text-muted);">${alreadyCheered ? 'Você brindou!' : 'Brindar à foto'}</span>
                    </div>
                </div>`;
            } else {
                return `
                <div style="background: var(--card-bg); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple)); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">💬</div>
                        <div>
                            <p style="font-weight: 700; font-size: 14px;">${item.sender_name}</p>
                            <p style="font-size: 11px; color: var(--text-muted);">${timeAgo}</p>
                        </div>
                    </div>
                    <p style="font-size: 15px; color: #fff; line-height: 1.5; padding: 10px 12px; background: rgba(255,255,255,0.04); border-radius: 10px; border-left: 3px solid var(--neon-cyan);">${item.text}</p>
                </div>`;
            }
        }).join('');

    } catch (e) {
        console.error("Erro ao carregar feed:", e);
    }
}

async function cheerPhoto(photoId, btn) {
    if (!currentCupId) return;
    try {
        const res = await fetch(`${API_BASE}/api/gallery/cheers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo_id: photoId, cup_id: currentCupId })
        });
        const data = await res.json();
        if (data.success) {
            const countEl = btn.querySelector(`.cheers-count-${photoId}`);
            if (countEl) countEl.textContent = data.cheers_count;
            btn.style.background = "rgba(255,42,116,0.15)";
            btn.style.borderColor = "rgba(255,42,116,0.5)";
            btn.style.color = "var(--neon-pink)";
            btn.disabled = true;
            btn.nextElementSibling.textContent = "Você brindou!";
        }
    } catch (e) { console.error(e); }
}

function formatTimeAgo(timestamp) {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 60) return "agora mesmo";
    if (diff < 3600) return `há ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff/3600)}h`;
    return `há ${Math.floor(diff/86400)}d`;
}

async function setupDashboardBubblesCanvas() {
    const container = document.getElementById("bubbles-canvas-container");
    dashboardCanvas = document.getElementById("bubbles-canvas");
    
    // Pegar usuários ativos no servidor
    try {
        const res = await fetch(`${API_BASE}/api/users`);
        const allUsers = await res.json();
        
        // Filtra para remover a si mesmo da pista de bolhas
        const otherUsers = allUsers.filter(u => u.id !== currentCupId);

        // Iniciar motor de física
        if (dashboardPhysics) {
            dashboardPhysics.stop();
        }
        
        dashboardPhysics = new BubblePhysicsEngine(dashboardCanvas, container, otherUsers, onBubbleClicked);
        dashboardPhysics.start();
        dashboardPhysics.applyFilter(activeLocationFilter);
        
    } catch (e) {
        console.error("Erro ao montar bolhas:", e);
    }
}

// Tratador de clique na bolha
function onBubbleClicked(user) {
    // Abrir modal de detalhes
    const modal = document.getElementById("profile-detail-modal");
    document.getElementById("modal-user-avatar").innerHTML = `<img src="${user.avatar}" alt="${user.name}">`;
    document.getElementById("modal-user-name").innerText = `${user.name}, ${user.age}`;
    document.getElementById("modal-user-location").innerText = `📍 ${user.location}`;
    document.getElementById("modal-user-clothes").innerText = user.clothes || "Sem descrição";

    const instEl = document.getElementById("modal-user-instagram");
    const brindeBtn = document.getElementById("btn-send-cheers");

    // Verificar se já temos match com essa pessoa para mostrar o instagram de graça
    checkIfHasMatch(user.id).then(hasMatch => {
        if (hasMatch) {
            instEl.innerText = `📱 Instagram: ${user.instagram}`;
            instEl.classList.remove("instagram-blurred");
            brindeBtn.innerText = "🥂 Conversar no Chat";
            brindeBtn.onclick = () => {
                modal.classList.remove("active");
                openChatWithUser(user.id);
            };
        } else {
            instEl.innerText = "🔒 Instagram liberado após Brinde!";
            instEl.classList.add("instagram-blurred");
            brindeBtn.innerText = "🥂 Brindar!";
            brindeBtn.setAttribute("data-target-id", user.id);
            brindeBtn.onclick = () => {
                sendCheers(user.id);
            };
        }
    });

    modal.classList.add("active");
}

async function checkIfHasMatch(otherId) {
    try {
        const res = await fetch(`${API_BASE}/api/matches?cup_id=${currentCupId}`);
        const matches = await res.json();
        return matches.some(m => m.user.id === otherId);
    } catch (e) {
        return false;
    }
}

async function openChatWithUser(otherId) {
    try {
        const res = await fetch(`${API_BASE}/api/matches?cup_id=${currentCupId}`);
        const matches = await res.json();
        const found = matches.find(m => m.user.id === otherId);
        if (found) {
            openChatScreen(found.match_id);
        }
    } catch (e) {
        console.error(e);
    }
}

// Renderizar visualização em grade
async function renderGridView() {
    const container = document.getElementById("users-grid-container");
    container.innerHTML = "<p class='loading'>Buscando pessoas...</p>";

    try {
        const res = await fetch(`${API_BASE}/api/users`);
        const allUsers = await res.json();
        const filtered = allUsers.filter(u => u.id !== currentCupId && (activeLocationFilter === "all" || u.location === activeLocationFilter));

        container.innerHTML = "";

        if (filtered.length === 0) {
            container.innerHTML = "<div class='empty-state'>Ninguém nesta área no momento.</div>";
            return;
        }

        filtered.forEach(user => {
            const card = document.createElement("div");
            card.className = "user-card";
            
            // Cor baseada em localização
            let colorClass = "pink";
            if (user.location === "Bar") colorClass = "green";
            if (user.location === "VIP") colorClass = "purple";
            if (user.location === "Palco") colorClass = "orange";

            card.innerHTML = `
                <div class="card-avatar ${colorClass}"><img src="${user.avatar}" alt="${user.name}"></div>
                <h3>${user.name}, ${user.age}</h3>
                <p>${user.clothes || "Curtindo a balada!"}</p>
                <span class="user-loc-badge ${user.location === 'VIP' ? 'pink' : ''}">📍 ${user.location}</span>
            `;
            card.onclick = () => onBubbleClicked(user);
            container.appendChild(card);
        });

    } catch (e) {
        container.innerHTML = "<p class='error'>Erro ao carregar pessoas.</p>";
    }
}


// ==========================================
// 4. LISTA DE MATCHES & CHAT PRIVADO
// ==========================================

async function loadMatchesList() {
    const container = document.getElementById("chats-list-container");
    container.innerHTML = "<p class='loading'>Carregando brindes confirmados...</p>";

    try {
        const res = await fetch(`${API_BASE}/api/matches?cup_id=${currentCupId}`);
        const matches = await res.json();

        container.innerHTML = "";

        if (matches.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p style="font-size: 32px; margin-bottom: 10px;">🥂</p>
                    <p>Nenhum brinde confirmado ainda.</p>
                    <p style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">
                        Toque nas bolhas de outras pessoas e mande um Brinde. Se elas aceitarem, o chat abre aqui!
                    </p>
                </div>
            `;
            return;
        }

        matches.forEach(m => {
            const item = document.createElement("div");
            item.className = "chat-item";
            item.innerHTML = `
                <div class="chat-avatar"><img src="${m.user.avatar}" alt="${m.user.name}"></div>
                <div class="chat-info">
                    <div class="chat-item-header">
                        <h4>${m.user.name}</h4>
                        <span class="chat-time">📍 ${m.user.location}</span>
                    </div>
                    <p class="chat-preview">Clique para abrir a conversa e resgatar o drink!</p>
                </div>
            `;
            item.onclick = () => openChatScreen(m.match_id);
            container.appendChild(item);
        });

    } catch (e) {
        container.innerHTML = "<p class='error'>Erro de conexão.</p>";
    }
}

// Abrir tela de chat
async function openChatScreen(matchId) {
    activeChatMatchId = matchId;
    changeScreen("screen-chat");

    // Configurar dados do destinatário
    try {
        const res = await fetch(`${API_BASE}/api/matches?cup_id=${currentCupId}`);
        const matches = await res.json();
        const m = matches.find(item => item.match_id === matchId);

        if (m) {
            document.getElementById("chat-user-avatar").innerHTML = `<img src="${m.user.avatar}" alt="${m.user.name}">`;
            document.getElementById("chat-user-name").innerText = m.user.name;
            document.getElementById("chat-user-loc").innerText = `📍 ${m.user.location}`;
        }

        // Limpar mensagens antigas na tela
        document.getElementById("chat-messages").innerHTML = "";

        // Iniciar loop de mensagens
        startChatLoop();
    } catch (e) {
        console.error(e);
    }
}

function startChatLoop() {
    stopChatLoop();
    fetchMessages();
    chatInterval = setInterval(fetchMessages, 2000);
}

function stopChatLoop() {
    if (chatInterval) {
        clearInterval(chatInterval);
        chatInterval = null;
    }
    activeChatMatchId = null;
}

async function fetchMessages() {
    if (!activeChatMatchId) return;

    try {
        const res = await fetch(`${API_BASE}/api/messages?match_id=${activeChatMatchId}`);
        const msgs = await res.json();

        const container = document.getElementById("chat-messages");
        const atBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;
        
        container.innerHTML = "";

        if (msgs.length === 0) {
            container.innerHTML = `<div class="chat-empty-tips">🥂 Digite algo para quebrar o gelo e combinar o local do encontro!</div>`;
            return;
        }

        msgs.forEach(msg => {
            const el = document.createElement("div");
            const isMe = msg.sender === currentCupId;
            el.className = `chat-msg ${isMe ? 'me' : 'other'}`;
            
            // Format time
            const date = new Date(msg.timestamp * 1000);
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

            el.innerHTML = `
                ${msg.text}
                <span class="chat-msg-time">${timeStr}</span>
            `;
            container.appendChild(el);
        });

        // Autoscroll se estava embaixo
        if (atBottom) {
            container.scrollTop = container.scrollHeight;
        }

    } catch (e) {
        console.error(e);
    }
}

async function sendMessage() {
    const input = document.getElementById("chat-input-field");
    const text = input.value.trim();
    if (!text || !activeChatMatchId) return;

    input.value = "";

    try {
        await fetch(`${API_BASE}/api/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                match_id: activeChatMatchId,
                sender: currentCupId,
                text: text
            })
        });
        
        // Atualizar imediatamente
        fetchMessages();
    } catch (e) {
        console.error(e);
    }
}


// ==========================================
// 5. TELÃO DA BALADA (PAINEL PÚBLICO)
// ==========================================
let telaoTickerInterval = null;

function startTelaoView() {
    const container = document.getElementById("telao-canvas-container");
    telaoCanvas = document.getElementById("telao-canvas");

    // Iniciar loop de atualização de dados e ticker
    updateTelaoData();
    telaoTickerInterval = setInterval(updateTelaoData, 4000);
}

function stopTelaoLoop() {
    if (telaoTickerInterval) {
        clearInterval(telaoTickerInterval);
        telaoTickerInterval = null;
    }
}

async function updateTelaoData() {
    try {
        const res = await fetch(`${API_BASE}/api/stats`);
        const data = await res.json();

        // 1. Atualizar contadores
        document.getElementById("telao-stat-users").innerText = data.users_count;
        document.getElementById("telao-stat-matches").innerText = data.matches_count;

        // 2. Atualizar Arena de Bolhas do Telão
        if (!telaoPhysics) {
            const container = document.getElementById("telao-canvas-container");
            // Roda apenas bolhas dos outros usuários conectados
            telaoPhysics = new BubblePhysicsEngine(telaoCanvas, container, data.active_users, null, true);
            telaoPhysics.start();
        } else {
            // Sincronizar usuários na arena sem recriar
            telaoPhysics.syncUsers(data.active_users);
        }

        // 3. Atualizar Ticker de Brindes Recentes
        const ticker = document.getElementById("telao-ticker-container");
        ticker.innerHTML = "";

        if (data.recent_matches.length === 0) {
            ticker.innerHTML = "<div class='empty-state-telao'>Aproxime seu copo NFC para brindar!</div>";
        } else {
            data.recent_matches.reverse().forEach(m => {
                const item = document.createElement("div");
                item.className = "ticker-item";
                item.innerHTML = `
                    <span class="ticker-cheers">🥂</span>
                    <div class="ticker-content">
                        <div class="ticker-names"><span>${m.user1}</span> & <span>${m.user2}</span></div>
                        <div class="ticker-sub">Novo Brinde Confirmado na Pista!</div>
                    </div>
                `;
                ticker.appendChild(item);
            });
        }

        // 3B. Atualizar Galeria do Telão
        const telaoGallery = document.getElementById("telao-gallery-container");
        if (telaoGallery && data.gallery_photos) {
            telaoGallery.innerHTML = "";
            if (data.gallery_photos.length === 0) {
                telaoGallery.innerHTML = "<p style='grid-column: span 3; font-size: 13px; color: var(--text-muted); text-align: center; padding: 10px;'>Galeria vazia. Envie a primeira foto!</p>";
            } else {
                data.gallery_photos.slice(-6).reverse().forEach(photo => {
                    const item = document.createElement("div");
                    item.style.cssText = "width: 100%; height: 95px; border-radius: 8px; overflow: hidden; border: 2px solid var(--neon-pink); box-shadow: var(--glow-pink); background: #000;";
                    item.innerHTML = `<img src="${photo.image}" style="width: 100%; height: 100%; object-fit: cover; display: block;">`;
                    telaoGallery.appendChild(item);
                });
            }
        }

        // 4. Atualizar Letreiro do Mural
        const muralTicker = document.getElementById("telao-mural-ticker");
        if (muralTicker && data.mural_messages) {
            if (data.mural_messages.length === 0) {
                muralTicker.innerText = "📣 Envie recados pelo Copo Social! Aproxime o celular do copo e participe.";
            } else {
                const texts = data.mural_messages.map(msg => `✨ ${msg.sender_name}: "${msg.text}"`).join("   |   ");
                muralTicker.innerText = `📣 ${texts}`;
            }
        }

        // 5. Comunicado Geral no Telão
        const announceBanner = document.getElementById("telao-announcement-banner");
        const announceText = document.getElementById("telao-announcement-text");
        if (announceBanner && announceText) {
            if (data.announcement) {
                announceText.innerText = data.announcement.text;
                announceBanner.classList.remove("hidden");
            } else {
                announceBanner.classList.add("hidden");
            }
        }

    } catch (e) {
        console.error(e);
    }
}


// ==========================================
// 6. VALIDADOR DO BARMAN
// ==========================================

async function barmanValidateMatch() {
    const matchCode = document.getElementById("barman-match-code").value.trim();
    if (!matchCode) {
        alert("Digite o código do match!");
        return;
    }

    try {
        // Obter status do match pelo id
        const res = await fetch(`${API_BASE}/api/users`);
        const users = await res.json();
        
        // O código do match é match_cup1_cup2
        const parts = matchCode.split('_');
        if (parts.length < 3 || parts[0] !== "match") {
            alert("Código de Match Inválido.");
            return;
        }

        const cup1 = parts[1];
        const cup2 = parts[2];

        const user1 = users.find(u => u.id === cup1);
        const user2 = users.find(u => u.id === cup2);

        if (user1 && user2) {
            document.getElementById("barman-names").innerText = `${user1.name} & ${user2.name}`;
            document.getElementById("barman-result").classList.remove("hidden");
        } else {
            alert("Erro: Um ou ambos os usuários do match não foram encontrados.");
        }
    } catch (e) {
        alert("Erro na conexão da API do Barman.");
    }
}


// ==========================================
// 7. PERSISTÊNCIA LOCAL PÓS-EVENTO
// ==========================================

function saveLocalProfile(profile) {
    localStorage.setItem("copo_social_my_profile", JSON.stringify(profile));
}

function saveSingleLocalMatch(user) {
    let saved = localStorage.getItem("copo_social_my_matches");
    let matches = saved ? JSON.parse(saved) : [];
    if (!matches.some(m => m.id === user.id)) {
        matches.push(user);
        localStorage.setItem("copo_social_my_matches", JSON.stringify(matches));
    }
}

function saveLocalMatches(matchesList) {
    // Transforma a lista do servidor em lista limpa de contatos
    const contacts = matchesList.map(m => m.user);
    localStorage.setItem("copo_social_my_matches", JSON.stringify(contacts));
}

function loadEndedScreenMatches() {
    const list = document.getElementById("ended-instagram-list");
    list.innerHTML = "";

    // Pega matches salvos no localStorage
    let saved = localStorage.getItem("copo_social_my_matches");
    let matches = saved ? JSON.parse(saved) : [];

    if (matches.length === 0) {
        list.innerHTML = "<div class='empty-state'>Você não salvou contatos nesta noite.</div>";
        return;
    }

    matches.forEach(user => {
        const item = document.createElement("div");
        item.className = "instagram-item";
        
        // Assegurar link correto
        const igLink = `https://instagram.com/${user.instagram.replace('@', '')}`;
        
        item.innerHTML = `
            <div>
                <strong>${user.name}</strong>
                <p style="font-size: 11px; color: var(--text-muted)">Dress code: ${user.clothes || 'Sem info'}</p>
            </div>
            <a href="${igLink}" target="_blank" class="ig-username">${user.instagram}</a>
        `;
        list.appendChild(item);
    });
}


// ==========================================
// 8. MOTOR DE FÍSICA E COLISÃO DAS BOLHAS
// ==========================================

class BubblePhysicsEngine {
    constructor(canvas, container, users, onClickCallback, isLargeTelao = false) {
        this.canvas = canvas;
        this.container = container;
        this.onClickCallback = onClickCallback;
        this.isLargeTelao = isLargeTelao;
        
        this.ctx = canvas.getContext("2d");
        this.users = users;
        this.allBubbles = [];
        this.filteredBubbles = [];
        this.animationId = null;
        this.activeFilter = "all";
        
        // Propriedades físicas
        this.bubbleRadius = isLargeTelao ? 55 : 36;
        this.gravity = -0.15; // Flutuar para cima
        this.friction = 0.99;
        
        // Posição do mouse para repulsão
        this.mouse = { x: -1000, y: -1000, active: false };
        
        this.init();
    }

    init() {
        this.resize();
        this.createBubbles();
        
        // Eventos
        this.resizeListener = () => this.resize();
        window.addEventListener("resize", this.resizeListener);
        
        this.setupInteraction();
    }

    resize() {
        // Redimensiona o canvas para preencher o container físico
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Reposicionar bolhas fora da tela para dentro
        this.allBubbles.forEach(b => {
            b.x = Math.max(b.radius, Math.min(this.canvas.width - b.radius, b.x));
            b.y = Math.max(b.radius, Math.min(this.canvas.height - b.radius, b.y));
        });
    }

    createBubbles() {
        this.allBubbles = [];
        this.users.forEach((user, index) => {
            const x = Math.random() * (this.canvas.width - this.bubbleRadius * 2) + this.bubbleRadius;
            const y = this.canvas.height + (index * 60) + Math.random() * 40;
            const color = VIBE_COLORS[user.vibe] || NEON_COLORS[user.location] || "#ff2a74";
            
            const img = new Image();
            img.src = user.avatar;
            
            this.allBubbles.push({
                user: user,
                id: user.id,
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -Math.random() * 1.2 - 0.5,
                radius: this.bubbleRadius,
                color: color,
                img: img
            });
        });
        
        this.applyFilter(this.activeFilter);
    }

    syncUsers(newUsersList) {
        const otherUsers = newUsersList.filter(u => u.id !== currentCupId);
        
        const currentIds = this.allBubbles.map(b => b.id);
        const newIds = otherUsers.map(u => u.id);
        
        this.allBubbles = this.allBubbles.filter(b => newIds.includes(b.id));
        
        otherUsers.forEach((user, index) => {
            if (!currentIds.includes(user.id)) {
                const x = Math.random() * (this.canvas.width - this.bubbleRadius * 2) + this.bubbleRadius;
                const y = this.canvas.height + this.bubbleRadius * 2;
                const color = VIBE_COLORS[user.vibe] || NEON_COLORS[user.location] || "#ff2a74";
                
                const img = new Image();
                img.src = user.avatar;
                
                this.allBubbles.push({
                    user: user,
                    id: user.id,
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: -Math.random() * 1.2 - 0.8,
                    radius: this.bubbleRadius,
                    color: color,
                    img: img
                });
            } else {
                const existing = this.allBubbles.find(b => b.id === user.id);
                if (existing) {
                    existing.user = user;
                    existing.color = VIBE_COLORS[user.vibe] || NEON_COLORS[user.location] || "#ff2a74";
                    if (existing.img.src !== user.avatar) {
                        existing.img = new Image();
                        existing.img.src = user.avatar;
                    }
                }
            }
        });
        
        this.applyFilter(this.activeFilter);
    }

    applyFilter(filterName) {
        this.activeFilter = filterName;
        if (filterName === "all") {
            this.filteredBubbles = this.allBubbles;
        } else {
            this.filteredBubbles = this.allBubbles.filter(b => b.user.location === filterName);
        }
    }

    setupInteraction() {
        const getCoordinates = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const onMove = (e) => {
            const coords = getCoordinates(e);
            this.mouse.x = coords.x;
            this.mouse.y = coords.y;
            this.mouse.active = true;
        };

        const onEnd = () => {
            this.mouse.active = false;
            this.mouse.x = -1000;
            this.mouse.y = -1000;
        };

        const onClick = (e) => {
            if (this.isLargeTelao) return; // Telão não é clicável
            
            const coords = getCoordinates(e);
            
            // Achar qual bolha foi clicada
            for (let b of this.filteredBubbles) {
                const dist = Math.hypot(coords.x - b.x, coords.y - b.y);
                if (dist <= b.radius) {
                    if (this.onClickCallback) {
                        this.onClickCallback(b.user);
                    }
                    break;
                }
            }
        };

        // Listeners Mouse
        this.canvas.addEventListener("mousemove", onMove);
        this.canvas.addEventListener("mouseleave", onEnd);
        this.canvas.addEventListener("click", onClick);

        // Listeners Touch
        this.canvas.addEventListener("touchmove", onMove);
        this.canvas.addEventListener("touchend", onEnd);
        this.canvas.addEventListener("touchstart", onClick);
    }

    update() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.filteredBubbles.forEach(b => {
            // 1. Aplicar Empuxo/Gravidade (Flutuar para cima)
            b.vy += this.gravity;
            
            // Fricção do fluido
            b.vx *= this.friction;
            b.vy *= this.friction;

            // Limitar velocidade de subida
            if (b.vy < -2.2) b.vy = -2.2;

            // Mover
            b.x += b.vx;
            b.y += b.vy;

            // 2. Colisão com Paredes Laterais
            if (b.x - b.radius < 0) {
                b.x = b.radius;
                b.vx *= -0.7;
            } else if (b.x + b.radius > width) {
                b.x = width - b.radius;
                b.vx *= -0.7;
            }

            // Colisão com Teto (Bate e desce devagar ou ressurge embaixo se for telão)
            if (b.y - b.radius < 0) {
                if (this.isLargeTelao) {
                    // Telão: Ressurge no fundo como uma nova bolha subindo
                    b.y = height + b.radius * 2;
                    b.x = Math.random() * (width - b.radius * 2) + b.radius;
                    b.vy = -Math.random() * 1.2 - 0.8;
                    b.vx = (Math.random() - 0.5) * 1.5;
                } else {
                    b.y = b.radius;
                    b.vy = Math.max(0.2, b.vy * -0.5);
                }
            }
            
            // Impedir que desça abaixo do rodapé (exeto ao entrar)
            if (b.y + b.radius > height + 100) {
                b.y = height + 100;
            }

            // 3. Repulsão pelo Dedo/Mouse (Magnetismo)
            if (this.mouse.active) {
                const dist = Math.hypot(b.x - this.mouse.x, b.y - this.mouse.y);
                const repelRange = 100;
                
                if (dist < repelRange) {
                    const angle = Math.atan2(b.y - this.mouse.y, b.x - this.mouse.x);
                    const force = (repelRange - dist) * 0.12;
                    b.vx += Math.cos(angle) * force;
                    b.vy += Math.sin(angle) * force;
                }
            }
        });

        // 4. Colisão de Círculo com Círculo (Física Elástica)
        for (let i = 0; i < this.filteredBubbles.length; i++) {
            for (let j = i + 1; j < this.filteredBubbles.length; j++) {
                const b1 = this.filteredBubbles[i];
                const b2 = this.filteredBubbles[j];

                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const dist = Math.hypot(dx, dy);
                const minDist = b1.radius + b2.radius;

                if (dist < minDist) {
                    // Sobreposição mínima -> empurrar para fora para evitar grudar
                    const overlap = minDist - dist;
                    const angle = Math.atan2(dy, dx);
                    
                    const moveX = Math.cos(angle) * overlap * 0.5;
                    const moveY = Math.sin(angle) * overlap * 0.5;

                    b1.x -= moveX;
                    b1.y -= moveY;
                    b2.x += moveX;
                    b2.y += moveY;

                    // Ajustar vetores de velocidade (Elastic Collision)
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const kx = b1.vx - b2.vx;
                    const ky = b1.vy - b2.vy;
                    const p = 2 * (nx * kx + ny * ky) / 2; // Massa idêntica

                    b1.vx -= p * nx;
                    b1.vy -= p * ny;
                    b2.vx += p * nx;
                    b2.vy += p * ny;
                }
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.filteredBubbles.forEach(b => {
            this.ctx.save();

            // 1. Sombras e brilhos neon
            this.ctx.shadowBlur = this.isLargeTelao ? 25 : 12;
            this.ctx.shadowColor = b.color;

            // 2. Fundo da bolha (translúcido estilo vidro)
            this.ctx.fillStyle = "rgba(18, 19, 26, 0.75)";
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // 3. Borda Neon Brilhante
            this.ctx.strokeStyle = b.color;
            this.ctx.lineWidth = this.isLargeTelao ? 3 : 2;
            this.ctx.stroke();

            // Desativar sombra
            this.ctx.shadowBlur = 0;

            // 4. Desenhar Imagem da Foto do Usuário Recortada em Círculo
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius - (this.isLargeTelao ? 3 : 2), 0, Math.PI * 2);
            this.ctx.clip();

            if (b.img && b.img.complete && b.img.naturalWidth !== 0) {
                this.ctx.drawImage(b.img, b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2);
            } else {
                // Fallback se não carregou: preenche com fundo escuro e iniciais
                this.ctx.fillStyle = "#161722";
                this.ctx.fill();
                this.ctx.font = `bold ${this.isLargeTelao ? 20 : 14}px 'Inter', sans-serif`;
                this.ctx.fillStyle = "#ffffff";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(b.user.name.substring(0, 2).toUpperCase(), b.x, b.y);
            }

            this.ctx.restore();

            // 5. Desenhar Nome do Usuário Embaixo (fora do clipping!)
            this.ctx.save();
            this.ctx.font = `bold ${this.isLargeTelao ? 13 : 10}px 'Inter', sans-serif`;
            this.ctx.fillStyle = "#ffffff";
            
            // Fundo escuro pequeno atrás do nome para legibilidade
            const textWidth = this.ctx.measureText(b.user.name).width;
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            this.ctx.fillRect(b.x - textWidth/2 - 4, b.y + (this.isLargeTelao ? 20 : 13), textWidth + 8, this.isLargeTelao ? 18 : 12);

            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(b.user.name, b.x, b.y + (this.isLargeTelao ? 28 : 18));

            this.ctx.restore();
        });
    }

    loop() {
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    start() {
        this.loop();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener("resize", this.resizeListener);
    }
}


// ==========================================
// 9. CONTROLES DO SIMULADOR (ADMIN)
// ==========================================

async function toggleEventStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/toggle-event`, { method: "POST" });
        const data = await res.json();
        
        const btn = document.getElementById("sim-toggle-event-btn");
        if (data.event_active) {
            btn.innerText = "Encerrar Evento (Off-line)";
            btn.className = "danger";
            alert("Evento ativado com sucesso!");
            
            // Tenta recarregar
            if (currentCupId) loginWithCup(currentCupId);
        } else {
            btn.innerText = "Iniciar Evento (On-line)";
            btn.className = "success";
            alert("Evento Encerrado! Todas as conexões ativas serão fechadas e os celulares verão a tela de fim de evento.");
            
            // Força tela de fim de evento
            changeScreen("screen-event-ended");
            loadEndedScreenMatches();
        }
    } catch (e) {
        alert("Erro ao alterar status do evento.");
    }
}

async function resetDatabase() {
    if (!confirm("Tem certeza que deseja apagar todos os usuários, brindes e mensagens?")) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/reset`, { method: "POST" });
        const data = await res.json();
        
        if (data.success) {
            alert("Banco de dados resetado com sucesso!");
            // Voltar para a tela de scan
            currentCupId = null;
            currentUser = null;
            changeScreen("screen-scan");
        }
    } catch (e) {
        alert("Erro ao resetar banco.");
    }
}

// ==========================================
// 10. RECURSOS DO MURAL DA BALADA E BRINDES
// ==========================================

async function loadMuralMessages() {
    const container = document.getElementById("mural-messages-container");
    container.innerHTML = "<p class='loading'>Carregando recados...</p>";
    try {
        const res = await fetch(`${API_BASE}/api/mural`);
        const messages = await res.json();
        container.innerHTML = "";
        
        if (messages.length === 0) {
            container.innerHTML = "<div class='empty-state' style='padding: 15px 0;'>Sem recados na pista ainda. Envie o seu acima!</div>";
            return;
        }
        
        messages.reverse().forEach(msg => {
            const item = document.createElement("div");
            item.className = "mural-msg-item";
            item.style.cssText = "background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); padding: 12px; border-radius: 12px; font-size: 13px; margin-bottom: 8px;";
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); padding-bottom: 4px;">
                    <strong style="color: var(--neon-cyan); font-size: 11px; text-transform: uppercase;">📣 Anônimo (${msg.sender_name})</strong>
                    <span style="font-size: 9px; color: var(--text-muted);">${new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <p style="color: #fff; line-height: 1.4; font-weight: 500; margin: 0;">${msg.text}</p>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = "<p class='error'>Erro ao buscar recados.</p>";
    }
}

async function sendMuralMessage() {
    const input = document.getElementById("mural-input");
    const text = input.value.trim();
    if (!text) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/mural`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: currentCupId, text })
        });
        const data = await res.json();
        
        if (data.error) {
            alert(data.error);
        } else {
            input.value = "";
            alert("Recado enviado! Passará pela moderação antes de aparecer no Telão. 😉");
            loadMuralMessages();
        }
    } catch (e) {
        alert("Erro ao enviar recado.");
    }
}

async function loadModerationMessages() {
    const container = document.getElementById("moderation-list");
    container.innerHTML = "<p class='loading'>Carregando moderação...</p>";
    try {
        const res = await fetch(`${API_BASE}/api/admin/mural`);
        const messages = await res.json();
        container.innerHTML = "";
        
        const pendings = messages.filter(m => m.status === "pending");
        
        if (pendings.length === 0) {
            container.innerHTML = "<p style='color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;'>Nenhum recado pendente no momento.</p>";
            return;
        }
        
        pendings.reverse().forEach(msg => {
            const item = document.createElement("div");
            item.style.cssText = "background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;";
            item.innerHTML = `
                <div style="font-size: 11px; color: var(--text-muted);">De: <strong>${msg.sender_name}</strong></div>
                <p style="color: #fff; font-size: 14px; font-weight: 500; margin: 0;">"${msg.text}"</p>
                <div style="display: flex; gap: 8px; margin-top: 4px;">
                    <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 12px; border-radius: 6px; background: #2a9d8f; border: none; font-weight: bold; cursor: pointer; color: white;" onclick="moderateMessage('${msg.id}', 'approve')">Aprovar ✅</button>
                    <button class="btn-secondary" style="flex: 1; padding: 8px; font-size: 12px; border-radius: 6px; background: #e63946; border: none; color: white; font-weight: bold; cursor: pointer;" onclick="moderateMessage('${msg.id}', 'reject')">Recusar ❌</button>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = "<p class='error'>Erro ao buscar moderação.</p>";
    }
}

async function moderateMessage(msgId, action) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/mural/moderate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ msg_id: msgId, action })
        });
        const data = await res.json();
        if (data.success) {
            loadModerationMessages();
        }
    } catch (e) {
        console.error("Moderation error:", e);
    }
}

async function simTriggerPromo() {
    const text = document.getElementById("sim-promo-text").value.trim();
    if (!text) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/trigger-promo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, duration: 60 })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById("sim-promo-text").value = "";
            alert("Campanha promocional relâmpago ativada por 60 segundos!");
        }
    } catch (e) {
        alert("Erro ao acionar promoção.");
    }
}

async function simDrawPrize() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/draw-prize`, { method: "POST" });
        const data = await res.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert(`🎁 Sorteio Realizado!\n\nCasal Premiado: ${data.winner_names}\n\nCódigo do Cupom: ${data.voucher}`);
        }
    } catch (e) {
        alert("Erro ao realizar sorteio.");
    }
}

// GALERIA DE FOTOS DA PISTA (CLIENT)
async function loadGalleryPhotos() {
    const container = document.getElementById("gallery-photos-container");
    if (!container) return;
    
    container.innerHTML = "<p class='loading' style='text-align: center; color: var(--text-muted); font-size: 13px;'>Buscando fotos...</p>";
    try {
        const res = await fetch(`${API_BASE}/api/gallery`);
        const photos = await res.json();
        container.innerHTML = "";
        
        if (photos.length === 0) {
            container.innerHTML = "<p style='text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;'>Nenhuma foto enviada ainda. Seja o primeiro! 📸</p>";
            return;
        }
        
        photos.reverse().forEach(photo => {
            const card = document.createElement("div");
            card.className = "gallery-photo-card glass";
            card.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px;";
            
            const header = document.createElement("div");
            header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; font-size: 11px; color: var(--text-muted);";
            header.innerHTML = `<span>📸 Enviada por <strong>${photo.sender_name}</strong></span>`;
            
            const imgContainer = document.createElement("div");
            imgContainer.style.cssText = "width: 100%; height: 200px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); background: #000;";
            const img = document.createElement("img");
            img.src = photo.image;
            img.style.cssText = "width: 100%; height: 100%; object-fit: cover; display: block;";
            imgContainer.appendChild(img);
            
            const footer = document.createElement("div");
            footer.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-top: 4px;";
            
            const cheersBtn = document.createElement("button");
            cheersBtn.className = "btn-secondary";
            cheersBtn.style.cssText = "padding: 6px 12px; font-size: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px;";
            cheersBtn.innerHTML = `🥂 Brindar à Foto`;
            cheersBtn.onclick = () => cheersPhoto(photo.id);
            
            const cheersCount = document.createElement("div");
            cheersCount.style.cssText = "font-size: 12px; color: var(--neon-cyan); font-weight: bold; text-shadow: var(--glow-cyan);";
            cheersCount.innerHTML = `🥂 ${photo.cheers_count || 0} Brindes`;
            
            footer.appendChild(cheersBtn);
            footer.appendChild(cheersCount);
            
            card.appendChild(header);
            card.appendChild(imgContainer);
            card.appendChild(footer);
            
            container.appendChild(card);
        });
    } catch (e) {
        container.innerHTML = "<p class='error' style='text-align: center;'>Erro ao carregar galeria.</p>";
    }
}

async function cheersPhoto(photoId) {
    if (!currentCupId) return;
    try {
        const res = await fetch(`${API_BASE}/api/gallery/cheers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo_id: photoId, cup_id: currentCupId })
        });
        const data = await res.json();
        if (data.success) {
            loadGalleryPhotos();
        }
    } catch (e) {
        console.error("Cheers photo error:", e);
    }
}

async function uploadGalleryPhoto(base64Image) {
    try {
        const res = await fetch(`${API_BASE}/api/gallery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: currentCupId, image: base64Image })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Foto enviada! Passará pela moderação antes de aparecer no Telão e na Galeria. 😉");
            loadGalleryPhotos();
        } else {
            alert("Erro ao enviar foto: " + (data.error || "Tente novamente."));
        }
    } catch (e) {
        alert("Erro ao enviar foto para a galeria.");
    }
}

// MODERAÇÃO DE FOTOS (ADMIN)
async function loadModerationPhotos() {
    const container = document.getElementById("moderation-photos-list");
    if (!container) return;
    
    container.innerHTML = "<p class='loading'>Carregando moderação...</p>";
    try {
        const res = await fetch(`${API_BASE}/api/admin/gallery`);
        const photos = await res.json();
        container.innerHTML = "";
        
        const pendings = photos.filter(p => p.status === "pending");
        
        if (pendings.length === 0) {
            container.innerHTML = "<p style='color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;'>Nenhuma foto pendente no momento.</p>";
            return;
        }
        
        pendings.reverse().forEach(photo => {
            const item = document.createElement("div");
            item.style.cssText = "background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;";
            item.innerHTML = `
                <div style="font-size: 11px; color: var(--text-muted);">De: <strong>${photo.sender_name}</strong></div>
                <div style="width: 100%; height: 180px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #000;">
                    <img src="${photo.image}" style="width: 100%; height: 100%; object-fit: contain; display: block;">
                </div>
                <div style="display: flex; gap: 8px; margin-top: 4px;">
                    <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 12px; border-radius: 6px; background: #2a9d8f; border: none; font-weight: bold; cursor: pointer; color: white;" onclick="moderatePhoto('${photo.id}', 'approve')">Liberar ✅</button>
                    <button class="btn-secondary" style="flex: 1; padding: 8px; font-size: 12px; border-radius: 6px; background: #e63946; border: none; color: white; font-weight: bold; cursor: pointer;" onclick="moderatePhoto('${photo.id}', 'reject')">Recusar ❌</button>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = "<p class='error'>Erro ao buscar moderação de fotos.</p>";
    }
}

async function moderatePhoto(photoId, action) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/gallery/moderate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo_id: photoId, action })
        });
        const data = await res.json();
        if (data.success) {
            loadModerationPhotos();
        }
    } catch (e) {
        console.error("Photo moderation error:", e);
    }
}

// DISPARAR COMUNICADO GERAL PARA TODOS OS USUÁRIOS
async function modSendAnnouncement() {
    const textInput = document.getElementById("mod-announcement-text");
    if (!textInput) return;
    
    const text = textInput.value.trim();
    if (!text) {
        alert("Digite alguma mensagem para disparar!");
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/trigger-announcement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("📣 Comunicado Geral enviado a todos com sucesso!");
            textInput.value = "";
        } else {
            alert("Erro ao disparar comunicado: " + (data.error || "Tente novamente."));
        }
    } catch (e) {
        alert("Erro de rede ao disparar comunicado.");
    }
}

async function modClearAnnouncement() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/clear-announcement`, {
            method: "POST"
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Comunicado removido! Os modais nos celulares serão ocultados.");
        }
    } catch (e) {
        console.error("Clear announcement error:", e);
    }
}
