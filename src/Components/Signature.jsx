// src/Components/Signature.jsx
import { useRef, useState, useEffect } from 'react';
import { FaDownload, FaCode, FaEraser, FaTimes, FaCopy, FaPen } from 'react-icons/fa';





function SignatureModal() {
    const canvasRef = useRef(null);
    const mobileCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savingStatus, setSavingStatus] = useState('');
    const [showBase64Modal, setShowBase64Modal] = useState(false);
    const [showMobileModal, setShowMobileModal] = useState(false);
    const [base64Data, setBase64Data] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL;

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, []);

    useEffect(() => {
        if (!showMobileModal) return;

        const canvas = mobileCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let drawing = false;

        const handleTouchStart = (e) => {
            e.preventDefault();
            const coords = getCoordinates(e, canvas);
            drawing = true;
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            if (!drawing) return;
            const coords = getCoordinates(e, canvas);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
        };

        const handleTouchEnd = (e) => {
            e.preventDefault();
            drawing = false;
        };

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
        };
    }, [showMobileModal]);

    const getCoordinates = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if (e.type.includes('touch')) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
    };

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const coords = getCoordinates(e, canvas);

        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    };

    const draw = (e) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const coords = getCoordinates(e, canvas);

        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setHasSignature(true);
        }
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = showMobileModal ? mobileCanvasRef.current : canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!showMobileModal) {
            setHasSignature(false);
        }
    };

    const showBase64 = () => {
        const canvas = canvasRef.current;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 400;
        finalCanvas.height = 100;
        const ctx = finalCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, 400, 100);
        const pngDataUrl = finalCanvas.toDataURL('image/png');
        const base64 = pngDataUrl.split(',')[1];
        setBase64Data(base64);
        setShowBase64Modal(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(base64Data);
        alert('Base64 copiado al portapapeles');
    };

    // Función para hacer fetch con timeout
    const fetchWithTimeout = async (url, options, timeout = 60000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    };

    // Función para reintentar con backoff exponencial
    const fetchWithRetry = async (url, options, maxRetries = 3) => {
        let lastError;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Timeout más largo para el primer intento (servidor puede estar despertando)
                const timeout = attempt === 0 ? 90000 : 60000;

                if (attempt === 0) {
                    setSavingStatus('Conectando con el servidor...');
                } else {
                    setSavingStatus(`Reintentando (${attempt + 1}/${maxRetries})...`);
                }

                const response = await fetchWithTimeout(url, options, timeout);
                return response;
            } catch (error) {
                lastError = error;

                if (attempt < maxRetries - 1) {
                    // Backoff exponencial: 2s, 4s, 8s
                    const delay = Math.pow(2, attempt + 1) * 1000;
                    setSavingStatus(`Error de conexión. Reintentando en ${delay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    setSavingStatus('');
                    throw lastError;
                }
            }
        }

        setSavingStatus('');
        throw lastError;
    };

    const saveSignature = async () => {
        const canvas = canvasRef.current;
        setIsSaving(true);
        setSavingStatus('Preparando firma...');

        try {
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 400;
            finalCanvas.height = 100;
            const ctx = finalCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, 0, 400, 100);
            const pngDataUrl = finalCanvas.toDataURL('image/png');
            const base64Data = pngDataUrl.split(',')[1];

            setSavingStatus('Conectando con el servidor...');

            const response = await fetchWithRetry(
                `${API_URL}/api/save-signature`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ signature: base64Data })
                },
                3 // máximo 3 reintentos
            );

            if (response.ok) {
                setSavingStatus('Descargando archivo...');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const timestamp = Date.now();
                const link = document.createElement('a');
                link.href = url;
                link.download = `signature_${timestamp}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                setSavingStatus('');
                alert('Firma descargada exitosamente');
            } else {
                setSavingStatus('');
                const result = await response.json();
                console.error('Error al guardar:', result);
                alert('Error al guardar la firma: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            setSavingStatus('');
            console.error('Error:', error);

            let errorMessage = 'Error al procesar la firma.';

            if (error.name === 'AbortError') {
                errorMessage = 'La conexión tardó demasiado. El servidor puede estar dormido. Por favor, intenta de nuevo en un momento.';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.';
            } else {
                errorMessage = 'Error: ' + error.message;
            }

            alert(errorMessage);
        } finally {
            setIsSaving(false);
            setSavingStatus('');
        }
    };

    const openMobileSignature = () => {
        setShowMobileModal(true);
        setTimeout(() => {
            const mainCanvas = canvasRef.current;
            const mobileCanvas = mobileCanvasRef.current;

            if (mainCanvas && mobileCanvas) {
                const mobileCtx = mobileCanvas.getContext('2d');
                mobileCtx.clearRect(0, 0, mobileCanvas.width, mobileCanvas.height);
                mobileCtx.drawImage(mainCanvas, 0, 0, 400, 100);
            }
        }, 50);
    };

    const closeMobileModal = () => {
        const mobileCanvas = mobileCanvasRef.current;
        const mainCanvas = canvasRef.current;

        if (mobileCanvas && mainCanvas) {
            const mainCtx = mainCanvas.getContext('2d');
            mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            mainCtx.drawImage(mobileCanvas, 0, 0, 400, 100);

            const imageData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
            const hasContent = imageData.data.some((channel, index) => {
                return index % 4 !== 3 && channel !== 0;
            });

            setHasSignature(hasContent);
        }

        setShowMobileModal(false);
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <img src="/favicon.svg" alt="Logo" style={styles.logo} />
                    <h1 style={styles.title}>E-Signature Test</h1>
                </div>

                <p style={styles.subtitle}>
                    {isMobile ? 'Toca el botón de abajo para firmar' : 'Dibuja tu firma en el área de abajo'}
                </p>

                {isMobile ? (
                    <div style={styles.mobilePreview} onClick={openMobileSignature}>
                        <canvas
                            ref={canvasRef}
                            width={400}
                            height={100}
                            style={{ ...styles.mobilePreviewCanvas, opacity: hasSignature ? 1 : 0.3 }}
                        />
                        <div style={{ ...styles.mobileOverlay, backgroundColor: hasSignature ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.9)' }}>
                            <FaPen size={30} color="#667eea" />
                            <p style={styles.mobileText}>{hasSignature ? 'Toca para editar' : 'Toca para firmar'}</p>
                        </div>
                    </div>
                ) : (
                    <div style={styles.canvasWrapper}>
                        <canvas
                            ref={canvasRef}
                            width={400}
                            height={100}
                            style={styles.canvas}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                        />
                    </div>
                )}

                <button onClick={clearSignature} style={styles.clearButton}>
                    <FaEraser style={styles.buttonIcon} />
                    Limpiar Firma
                </button>

                {savingStatus && (
                    <div style={styles.statusMessage}>
                        <div style={styles.spinner}></div>
                        <span>{savingStatus}</span>
                    </div>
                )}

                <div style={isMobile ? styles.actionButtonsMobile : styles.actionButtons}>
                    <button
                        onClick={saveSignature}
                        style={{ ...styles.button, ...styles.downloadButton }}
                        disabled={isSaving}
                    >
                        <FaDownload style={styles.buttonIcon} />
                        {isSaving ? 'Descargando...' : 'Descargar PNG'}
                    </button>
                    <button
                        onClick={showBase64}
                        style={{ ...styles.button, ...styles.base64Button }}
                    >
                        <FaCode style={styles.buttonIcon} />
                        Ver Base64
                    </button>
                </div>
            </div>

            {showMobileModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.mobileModalContent}>
                        <div style={styles.mobileModalHeader}>
                            <h2 style={styles.mobileModalTitle}>Dibuja tu firma</h2>
                            <button onClick={closeMobileModal} style={styles.closeButton}>
                                <FaTimes size={24} />
                            </button>
                        </div>
                        <div style={styles.mobileCanvasWrapper}>
                            <canvas
                                ref={mobileCanvasRef}
                                width={400}
                                height={100}
                                style={styles.mobileCanvas}
                            />
                        </div>
                        <div style={styles.mobileModalFooter}>
                            <button onClick={clearSignature} style={styles.mobileClearButton}>
                                <FaEraser style={styles.buttonIcon} />
                                Limpiar
                            </button>
                            <button onClick={closeMobileModal} style={styles.mobileCloseButton}>
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBase64Modal && (
                <div style={styles.modalOverlay} onClick={() => setShowBase64Modal(false)}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>Base64 de la Firma</h2>
                            <button
                                onClick={() => setShowBase64Modal(false)}
                                style={styles.closeButton}
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>
                        <textarea
                            readOnly
                            value={base64Data}
                            style={styles.textarea}
                        />
                        <div style={styles.modalFooter}>
                            <button onClick={copyToClipboard} style={styles.copyButton}>
                                <FaCopy style={styles.buttonIcon} />
                                Copiar al Portapapeles
                            </button>
                            <button
                                onClick={() => setShowBase64Modal(false)}
                                style={styles.modalCloseButton}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        padding: '40px',
        maxWidth: '600px',
        width: '100%',
        animation: 'fadeIn 0.5s ease-in'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '15px',
        marginBottom: '10px'
    },
    logo: {
        width: '50px',
        height: '50px',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
    },
    title: {
        fontSize: '32px',
        fontWeight: '700',
        color: '#2d3748',
        margin: 0
    },
    subtitle: {
        textAlign: 'center',
        color: '#718096',
        fontSize: '16px',
        marginBottom: '30px'
    },
    canvasWrapper: {
        border: '3px dashed #cbd5e0',
        borderRadius: '12px',
        marginBottom: '20px',
        backgroundColor: '#f7fafc',
        cursor: 'crosshair',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
    },
    canvas: {
        display: 'block',
        width: '100%',
        height: 'auto',
        touchAction: 'none'
    },
    mobilePreview: {
        position: 'relative',
        border: '3px dashed #cbd5e0',
        borderRadius: '12px',
        marginBottom: '20px',
        backgroundColor: '#f7fafc',
        overflow: 'hidden',
        cursor: 'pointer',
        minHeight: '150px'
    },
    mobilePreviewCanvas: {
        display: 'block',
        width: '100%',
        height: 'auto'
    },
    mobileOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)'
    },
    mobileText: {
        color: '#667eea',
        fontSize: '18px',
        fontWeight: '600',
        margin: 0
    },
    clearButton: {
        width: '100%',
        padding: '14px',
        backgroundColor: '#e2e8f0',
        color: '#2d3748',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '20px',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    },
    statusMessage: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '15px',
        backgroundColor: '#edf2f7',
        borderRadius: '10px',
        marginBottom: '20px',
        color: '#4a5568',
        fontSize: '14px',
        fontWeight: '500'
    },
    spinner: {
        width: '20px',
        height: '20px',
        border: '3px solid #e2e8f0',
        borderTop: '3px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    actionButtons: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px'
    },
    actionButtonsMobile: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    },
    button: {
        padding: '14px 20px',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    },
    buttonIcon: {
        fontSize: '18px'
    },
    downloadButton: {
        backgroundColor: '#48bb78',
        color: '#ffffff'
    },
    base64Button: {
        backgroundColor: '#4299e1',
        color: '#ffffff'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 0.3s ease-in'
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
    },
    mobileModalContent: {
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '20px',
        width: '95%',
        maxWidth: '500px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    mobileModalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
    },
    modalTitle: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#2d3748',
        margin: 0
    },
    mobileModalTitle: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#2d3748',
        margin: 0
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#718096',
        padding: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    mobileCanvasWrapper: {
        border: '3px dashed #cbd5e0',
        borderRadius: '12px',
        backgroundColor: '#f7fafc',
        overflow: 'hidden',
        marginBottom: '15px',
        touchAction: 'none'
    },
    mobileCanvas: {
        display: 'block',
        width: '100%',
        height: 'auto',
        touchAction: 'none'
    },
    mobileModalFooter: {
        display: 'flex',
        gap: '10px'
    },
    mobileClearButton: {
        flex: 1,
        padding: '12px',
        backgroundColor: '#e2e8f0',
        color: '#2d3748',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    },
    mobileCloseButton: {
        flex: 1,
        padding: '12px',
        backgroundColor: '#48bb78',
        color: '#ffffff',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600'
    },
    textarea: {
        width: '100%',
        minHeight: '200px',
        padding: '15px',
        border: '2px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        resize: 'vertical',
        marginBottom: '20px',
        backgroundColor: '#f7fafc',
        color: '#2d3748'
    },
    modalFooter: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end',
        flexWrap: 'wrap'
    },
    copyButton: {
        padding: '12px 24px',
        backgroundColor: '#4299e1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    modalCloseButton: {
        padding: '12px 24px',
        backgroundColor: '#e2e8f0',
        color: '#2d3748',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.3s ease'
    }
};

// Animación del spinner
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(styleSheet);

export default SignatureModal;