# Circuit Breaker Pattern 🔌⚡

Implementación educativa del patrón **Circuit Breaker** para manejar fallos en servicios externos y prevenir cascadas de fallos.

## 🔥 El Problema Real

Imagina este escenario:

- Tu API debe enviar **20,000 notificaciones** a través de un proveedor externo (Firebase, OneSignal)
- El proveedor se cae temporalmente
- Tu sistema sigue intentando enviar **→ Satura CPU**
- Reintenta constantemente **→ Satura red**
- Acumula mensajes en cola **→ Backlog infinito**
- Los errores se propagan **→ Colapso en cascada** 🌊

Esto se llama: **Failure Cascade** (Fallo en cascada)

## 🔎 ¿Qué es un Circuit Breaker?

Es un patrón de diseño que actúa como **interruptor inteligente** entre tu aplicación y servicios externos.

**Detecta fallos consecutivos y detiene el flujo temporalmente** para permitir que el servicio se recupere.

### ¿Cómo funciona?

1. Monitorea cada operación hacia el servicio externo
2. Cuenta fallos consecutivos
3. Cuando alcanza el **umbral (threshold)**, **abre el circuito**
4. Detiene todas las llamadas futuras (fallan inmediatamente)
5. Después de un tiempo, intenta recuperarse (**HALF_OPEN**)
6. Si funciona → vuelve a **CLOSED**
7. Si falla → vuelve a **OPEN**

## 🧠 Estados del Circuit Breaker

```
                    ┌─────────────┐
                    │   CLOSED    │  ✅ Normal
                    │  (Normal)   │  Todo fluye
                    └──────┬──────┘
                           │
                    [Fallos ≥ threshold]
                           │
                           ▼
     ┌─────────────────────────────────────────┐
     │           OPEN (Protección)             │ ❌ Bloqueado
     │   No se permiten llamadas               │  Fallas inmediatas
     │   Espera recoveryTimeout                │
     └──────────────────┬──────────────────────┘
                        │
            [Timeout expirado]
                        │
                        ▼
     ┌─────────────────────────────────────────┐
     │         HALF_OPEN (Prueba)              │ 🟡 Probando
     │   Permite 1 intento                     │  Recuperación
     │   Si ok → CLOSED                        │
     │   Si error → OPEN                       │
     └─────────────────────────────────────────┘
```

## 📦 Arquitectura (Clean Architecture)

```
src/
├── notification/
│   ├── domain/                          ← Lógica pura
│   │   ├── notification.entity.ts       (Entidad de dominio)
│   │   └── push-provider.interface.ts   (Contrato)
│   │
│   ├── application/                     ← Casos de uso
│   │   └── send-notification.usecase.ts (Orquesta la lógica)
│   │
│   ├── infraestructure/                 ← Implementaciones
│   │   └── fake-push-provider.client.ts (Proveedor simulado)
│   │
│   └── notification.module.ts           (Factory - composición)
│
└── shared/
    └── services/
        └── circuit-breaker.service.ts   (Patrón Circuit Breaker)
```

## 🔧 Componentes Principales

### 1. **Notification Entity** 
Representa una notificación simple con recipiente y mensaje.

### 2. **PushProvider Interface**
Contrato que define cómo deben comportarse los proveedores de push.

```typescript
interface PushProvider {
  sendNotification(notification: Notification): Promise<void>;
}
```

### 3. **FakePushProviderClient**
Simula un proveedor real que **falla el 70% de las veces**:
- Útil para testing y demos
- Permite ver el Circuit Breaker en acción

### 4. **CircuitBreaker Service**
Implementa la lógica de los 3 estados:

**Configuración:**
- `failureThreshold`: 5 fallos → abre circuito
- `recoveryTimeout`: 1000ms → intenta recuperarse

**Estados:**
- `CLOSED`: Normal
- `OPEN`: Bloqueado
- `HALF_OPEN`: Probando recuperación

### 5. **SendNotificationUseCase**
Orquesta:
1. Crea entidad Notification
2. Ejecuta a través del Circuit Breaker
3. Registra el resultado

## 🚀 Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar la simulación
npm run start:main

# El sistema enviará notificaciones cada segundo
# Verás en consola los estados del Circuit Breaker
```

### 📊 Qué observarás en la ejecución:

```
📲 Sent to: user123           ← Éxito
Error sending notification    ← Fallos iniciales (contados)
Error sending notification
...
❌ CIRCUIT BREAKER OPEN       ← Después de 5 fallos
Circuit is OPEN              ← Bloquea futuras llamadas
...
⏳ HALF_OPEN                  ← Después de 1 segundo (timeout)
Circuit is OPEN              ← Prueba pero sigue fallando
...
✅ CIRCUIT BREAKER CLOSED     ← Finalmente recuperado
📲 Sent to: user123           ← Vuelve al flujo normal
```

## 📚 Flujo de Datos

```
main.ts (cada 1 segundo)
    ↓
SendNotificationUseCase.execute()
    ↓
CircuitBreaker.execute()
    ├─ Verifica estado
    ├─ Si CLOSED: intenta operación
    ├─ Si OPEN: rechaza inmediatamente
    └─ Si HALF_OPEN: permite 1 intento
         ↓
    FakePushProviderClient.sendNotification()
         ↓
    onSuccess() o onFailure()
         ↓
    Gestiona transiciones de estado
```

## 🎓 Conceptos Clave

| Concepto | Explicación |
|----------|-------------|
| **Failure vs Error** | Error = excepción de código. Failure = operación que falló (ej: timeout, 500) |
| **Threshold** | Número máximo de fallos antes de abrir el circuito |
| **Recovery Timeout** | Tiempo de espera antes de intentar recuperarse |
| **Fail Fast** | Cuando OPEN, falla inmediatamente sin intentar (ahorra recursos) |
| **Cascading Failures** | Cuando un fallo se propaga a múltiples sistemas |

## 🔍 Casos de Uso Reales

✅ **Llamadas a APIs externas** (Firebase, Stripe, etc)  
✅ **Conexiones a bases de datos**  
✅ **Llamadas a microservicios**  
✅ **Operaciones de I/O lentitud**  

## 💡 Mejoras Posibles

- Agregar métricas (contadores, timestamps)
- Implementar backoff exponencial
- Agregar logs detallados
- Permitir múltiples intentos en HALF_OPEN
- Notificaciones cuando cambia de estado
- Configuración dinámica

## 📖 Referencias

- [Release It! - Michael Nygard](https://pragprog.com/titles/mnee2/release-it-second-edition/)
- [Circuit Breaker Pattern - Martin Fowler](https://martinfowler.com/bliki/CircuitBreaker.html)