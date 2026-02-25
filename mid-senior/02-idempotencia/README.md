# Idempotencia - Sistema de Facturación Electrónica Masiva

## Tabla de Contenidos
1. [Introducción](#introducción)
2. [Teoría](#teoría)
3. [Caso de Uso Real](#caso-de-uso-real)
4. [Implementación](#implementación)
5. [Arquitectura](#arquitectura)
6. [Cómo Ejecutar](#cómo-ejecutar)
7. [Resultados Esperados](#resultados-esperados)
8. [Mejores Prácticas](#mejores-prácticas)

---

## Introducción

**Idempotencia** es uno de los concejos más críticos en sistemas distribuidos. Un simple retry sin idempotencia puede convertir un fallo temporal en un desastre:

```
❌ SIN IDEMPOTENCIA:
  Intento 1: Falla, respuesta perdida → Factura registrada en BD
  Retry:     Intento 2 → Factura duplicada
  Resultado: Cobro doble, inconsistencia

✅ CON IDEMPOTENCIA:
  Intento 1: Falla, respuesta perdida → Factura registrada con ID único
  Retry:     Intento 2 → Sistema detecta mismo ID, retorna resultado anterior
  Resultado: Una sola factura, consistencia garantizada
```

---

## Teoría

### 1. Definición Matemática

Una operación es **idempotente** si aplicarla una o múltiples veces produce el mismo resultado:

```
f(x) = f(f(x)) = f(f(f(x))) = ... = f(x)

Ejemplo IDEMPOTENTE:
  - abs(-5) = 5
  - abs(abs(-5)) = abs(5) = 5 ✅ Mismo resultado

Ejemplo NO IDEMPOTENTE:
  - increment(5) = 6
  - increment(increment(5)) = increment(6) = 7 ❌ Diferente resultado
```

### 2. El Problema en Sistemas Distribuidos

#### 2.1 Escenario Típico de Fallo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CLIENTE ENVÍA SOLICITUD                                  │
│    POST /invoices/send                                      │
│    Body: { invoiceId: "INV-001", amount: 1000 }            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓ (SERVIDOR RECIBE)
┌─────────────────────────────────────────────────────────────┐
│ 2. SERVIDOR PROCESA                                         │
│    ✅ Valida datos                                          │
│    ✅ Registra en BD: INSERT INTO invoices                 │
│    ✅ Actualiza estadísticas                                │
│    ✅ Prepara respuesta JSON                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓ (RESPUESTA ENVIADA)
                   │
            ❌ CONEXIÓN CORTADA
            (Cliente nunca recibe respuesta)
                   │
                   ↓ (CLIENTE DESCONOCE RESULTADO)
┌─────────────────────────────────────────────────────────────┐
│ 3. CLIENTE: ¿Qué pasó?                                      │
│    - ¿Se procesó la factura?                               │
│    - ¿Falló completamente?                                 │
│    → SOLUCIÓN: REINTENTAR                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓ (REINTENTO SIN IDEMPOTENCIA)
┌─────────────────────────────────────────────────────────────┐
│ 4. SERVIDOR RECIBE SOLICITUD NUEVAMENTE                    │
│    POST /invoices/send                                      │
│    Body: { invoiceId: "INV-001", amount: 1000 }            │
│                                                             │
│    ❌ PROBLEMA: El servidor NO SABE que ya procesó esto    │
│    ❌ Registra OTRA VEZ: INSERT INTO invoices              │
│                                                             │
│    RESULTADO: DOS FACTURAS IDÉNTICAS EN LA BD              │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Consecuencias de Duplicados

En sistemas de facturación, los duplicados son **catastróficos**:

```
IMPACTO FINANCIERO:
  ❌ Factura 001: $1,000.00
  ❌ Factura 001 (duplicada): $1,000.00
  = El cliente es cobrado 2 veces (fraude)

IMPACTO REGULATORIO:
  ❌ Registros duplicados en SUNAT/SAT/DIAN
  ❌ Inconsistencia en auditoría
  ❌ Multas por incumplimiento

IMPACTO OPERATIVO:
  ❌ Conciliación manual imposible
  ❌ Desconfianza en el sistema
  ❌ Soporte técnico abrumado
```

### 3. Soluciones a la Idempotencia

#### 3.1 Sin Idempotencia (Débil)

```typescript
// ❌ PELIGROSO: Cada solicitud crea nueva factura
async function sendInvoice(invoiceData) {
  await db.invoices.insert({
    ...invoiceData,
    status: 'SENT'
  });
  return { success: true };
}

// Problema:
// - Solicitud 1: Inserta factura
// - Solicitud 2 (reintento): Inserta OTRA factura
// - Resultado: DUPLICADO
```

#### 3.2 Idempotencia Nivel API (Básico)

```typescript
// ⚠️ MEJOR: Usa un Idempotency-Key
async function sendInvoice(invoiceData, idempotencyKey) {
  // Busca si ya procesó sin terminar
  const existing = await db.requests.findOne({ idempotencyKey });
  
  if (existing) {
    return existing.response; // Retorna resultado anterior
  }
  
  // Procesa normalmente
  const result = await processInvoice(invoiceData);
  
  // Guarda para futuras solicitudes
  await db.requests.save({
    idempotencyKey,
    response: result
  });
  
  return result;
}

// Funciona pero requiere:
// - Cliente debe generar Idempotency-Key
// - Servidor almacena respuestas (cache)
// - Limpieza de respuestas antiguas
```

#### 3.3 Idempotencia Nivel Base de Datos (Robusto) ⭐

```typescript
// ✅ PROFESIONAL: Índice único + validación previa
async function sendInvoice(externalId, amount) {
  // 1. VALIDACIÓN PREVIA
  const existing = await db.invoices.findOne({ externalId });
  
  if (existing && existing.status === 'SENT') {
    // Ya fue enviada → no hacer nada
    return { alreadySent: true };
  }
  
  // 2. INSERTAR O ACTUALIZAR CON ÍNDICE ÚNICO
  await db.invoices.updateOne(
    { externalId }, // ← Busca por externalId ÚNICO
    {
      $set: {
        externalId,
        amount,
        status: 'PENDING'
      }
    },
    { upsert: true } // Crea si no existe, actualiza si existe
  );
  
  // 3. PROCESAR
  await api.send(externalId);
  
  // 4. ACTUALIZAR ESTADO
  await db.invoices.updateOne(
    { externalId },
    { $set: { status: 'SENT' } }
  );
}

// Garantías:
// - Índice UNIQUE previene duplicados a nivel BD
// - Validación previa evita reintentos
// - Status rastreable (PENDING → SENT)
// - No requiere cache externo
```

### 4. Tipos de Idempotencia

#### 4.1 Idempotencia de Lectura (Segura)

```typescript
// ✅ 100% seguro - solo lee datos
async function getInvoice(invoiceId) {
  return await db.invoices.findOne({ invoiceId });
}

// Puedes llamar 1000 veces → mismo resultado
```

#### 4.2 Idempotencia de Escritura (Compleja)

```typescript
// ❌ PELIGROSO: Sin protección
async function createInvoice(data) {
  await db.invoices.insert(data); // Duplicado en reintento
}

// ✅ SEGURO: Con upsert + índice único
async function createInvoice(externalId, data) {
  await db.invoices.updateOne(
    { externalId }, // ← Clave única
    { $set: data },
    { upsert: true }
  );
}
```

#### 4.3 Idempotencia de Eliminación (Especial)

```typescript
// ✅ DELETE es naturalmente idempotente
await db.invoices.deleteOne({ invoiceId });
// Ejecutar 2 veces = mismo resultado (0 filas borradas la segunda)
```

### 5. Matriz de Idempotencia HTTP

```
┌────────────┬───────────────┬────────────────────┐
│   Método   │  Idempotente  │  Seguro (no-write) │
├────────────┼───────────────┼────────────────────┤
│ GET        │      ✅       │        ✅          │
│ HEAD       │      ✅       │        ✅          │
│ OPTIONS    │      ✅       │        ✅          │
│ TRACE      │      ✅       │        ✅          │
├────────────┼───────────────┼────────────────────┤
│ PUT        │      ✅       │        ❌          │
│ DELETE     │      ✅       │        ❌          │
├────────────┼───────────────┼────────────────────┤
│ POST       │      ❌       │        ❌          │
│ PATCH      │      ❌       │        ❌          │
└────────────┴───────────────┴────────────────────┘

Nota: POST es intrinsicamente NO idempotente
      Requiere Idempotency-Key para hacerlo seguro
```

---

## Caso de Uso Real

### Escenario: Facturación Electrónica Regulada

#### Contexto

En sistemas de facturación electrónica:
- La factura es un **contrato legal** irrevocable
- Cada factura tiene un correlativo único
- Una vez registrada, **no se puede duplicar**
- El regulador rechazará duplicados y multará

```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 Sistema ERP                                              │
│   Genera factura: INV-00001                                 │
│   Monto: $1,000.00                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓ (Envía al regulador)
┌─────────────────────────────────────────────────────────────┐
│ 🌐 API SUNAT/SAT/DIAN                                       │
│   Validaciones:                                             │
│   - RUC válido ✅                                           │
│   - Datos completos ✅                                      │
│   - Campos requeridos ✅                                    │
│   - Duplicados ❌ RECHAZA CON MULTA                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 📊 BD Reguladora                                            │
│   INSERT INTO facturas (                                    │
│     numero_factura = '00001',   ← ÚNICO (índice)           │
│     ruc_emisor = '20123456789', ← ÚNICO (índice compuesto) │
│     monto = 1000.00,                                       │
│     fecha = '2026-02-25'                                   │
│   );                                                        │
│                                                             │
│   Si se vuelve a enviar misma combinación:                │
│   → ERROR: UNIQUE constraint violation                      │
│   → Rechaza la factura                                      │
└─────────────────────────────────────────────────────────────┘
```

#### Casos de Fallo y Recuperación

**Caso 1: Timeout Temporal**

```
13:00:00 → Sistema envía INV-00001
13:00:05 → API reguladora recibe y procesa ✅
13:00:10 → Respuesta perdida (timeout cliente)
13:00:11 → Sistema reintenta

SIN IDEMPOTENCIA:
  ❌ Reguladora recibe OTRA vez y crea OTRA factura
  ❌ RESULTADO: INV-00001 aparece 2 veces en reguladora

CON IDEMPOTENCIA:
  ✅ Sistema valida: ¿INV-00001 ya fue enviada?
  ✅ Descubre que SÍ (status = SENT)
  ✅ No reintenta
  ✅ RESULTADO: INV-00001 aparece 1 sola vez
```

**Caso 2: Fallo de Red Intermitente**

```
10:00:00 → Sistema envía INV-00001
10:00:02 → Servidor regulador empieza a procesar
10:00:03 → RED SE CUELGA (no hay respuesta)
10:00:04 → Socket timeout en cliente
10:00:05 → Cliente reintenta

ARQUITECTURA SIN IDEMPOTENCIA:
  ❌ Servidor reguladora recibe solicitud nuevamente
  ❌ Verifica: ¿existe INV-00001? NO (aún no insertó en BD)
  ❌ Procesa y crea DUPLICADO

ARQUITECTURA CON IDEMPOTENCIA:
  ✅ Servidor reguladora recibe solicitud nuevamente
  ✅ Verifica: ¿existe externalId='INV-00001'? SÍ (ya etá en BD)
  ✅ Estado es PENDING (en progreso) → No procesa
  ✅ Retorna: "Ya está siendo procesada"
  ✅ Resultado: Una sola entrada en BD
```

**Caso 3: Crash del Servidor Cliente**

```
10:00:00 → Sistema envía INV-00001
10:00:01 → Reguladora recibe, procesa, guarda
10:00:02 → Reguladora envía respuesta... 
10:00:02 → ROUTER SE CUELGA (respuesta no llega)
10:00:03 → Cliente SE CUELGA (crash)
10:00:05 → Cliente reinicia
10:00:06 → "¿Qué pasó con INV-00001?" → REINTENTA

SIN IDEMPOTENCIA:
  ❌ Reguladora procesa OTRA VEZ
  ❌ Crea segundo registro
  ❌ PÉRDIDA FINANCIERA: cliente cobrado 2 veces

CON IDEMPOTENCIA:
  ✅ Cliente: "¿INV-00001 ya existe?" SÍ, status=SENT
  ✅ No reintenta, consulta reguladora
  ✅ Obtiene confirmación original
  ✅ SEGURIDAD: factura registrada solo 1 vez
```

---

## Implementación

### Estrategia de Idempotencia en el Código

Este proyecto implementa **idempotencia a nivel base de datos** combinada con **validación previa**:

```typescript
// FLUJO IDEMPOTENTE:

// 1. VALIDACIÓN PREVIA
const existing = await repository.findByExternalId(externalId);

if (existing && existing.status === 'SENT') {
  // Ya fue enviada → RETORNA SIN HACER NADA
  logger.info(`Factura ${externalId} ya fue enviada`);
  return;
}

// 2. CREAR/ACTUALIZAR CON UPSERT
const invoice = new Invoice(externalId, amount, 'PENDING');
await repository.save(invoice); 
// MongoDB: updateOne con { upsert: true }
// Garantiza: Solo existe UNA factura por externalId

// 3. ENVIAR A API REGULADORA
await retryService.execute(
  () => invoiceApiClient.send(invoice),
  { maxAttempts: 1, shouldRetry: error => error.code === 503 }
);

// 4. MARCAR COMO ENVIADA
invoice.markAsSent(); // status = 'SENT'
await repository.save(invoice);
// MongoDB: $set actualiza el mismo documento

// GARANTÍA: Aunque se reintente, status pasa de:
// PENDING → SENT (una sola vez)
```

### Servicios Principales

#### 1. SendInvoiceUseCase ⭐

```typescript
async execute(externalId: string, amount: number) {
  // ✅ Validación previa (idempotencia)
  const existing = await repository.findByExternalId(externalId);
  if (existing && existing.status === 'SENT') {
    return; // Ya enviada, no hacer nada
  }

  // ✅ Crear con upsert (no duplica)
  const invoice = new Invoice(externalId, amount, 'PENDING');
  await repository.save(invoice);

  // ✅ Enviar con retry
  await retryService.execute(
    () => invoiceApiClient.send(invoice),
    { maxAttempts: 1, baseDelayMs: 500, ... }
  );

  // ✅ Actualizar estado
  invoice.markAsSent();
  await repository.save(invoice);
}
```

#### 2. MongoInvoiceRepository

```typescript
async save(invoice: Invoice): Promise<void> {
  // MongoDB updateOne con upsert
  // Si externalId existe: ACTUALIZA
  // Si externalId NO existe: INSERTA
  // Garantía: Índice UNIQUE previene duplicados
  
  await db.collection('invoices').updateOne(
    { externalId: invoice.externalId },
    { $set: { externalId, amount, status } },
    { upsert: true }  // ← KEY: Crea si no existe
  );
}
```

#### 3. Invoice Entity

```typescript
export class Invoice {
  constructor(
    public readonly externalId: string,  // ← Clave única
    public readonly amount: number,
    public status: 'PENDING' | 'SENT'
  ) {}

  markAsSent() {
    this.status = 'SENT';
  }
}
```

---

## Arquitectura

### Flujo Idempotente Completo

```
SOLICITUD ENTRA (INV-001)
        │
        ├─→ SendInvoiceUseCase.execute('INV-001', 1000)
        │         │
        │         ├─→ ¿Existe INV-001 en BD? (findByExternalId)
        │         │   │
        │         │   ├─✅ SÍ existe + status='SENT'
        │         │   │   └─→ RETORNA SIN HACER NADA
        │         │   │       (IDEMPOTENCIA: No se duplica)
        │         │   │
        │         │   └─❌ NO existe ó status='PENDING'
        │         │       └─→ CONTINÚA FLUJO
        │         │
        │         ├─→ Crear Invoice(externalId, amount, 'PENDING')
        │         │
        │         ├─→ repository.save()
        │         │   └─→ MongoDB updateOne con { upsert: true }
        │         │       ✅ Índice UNIQUE en externalId
        │         │       ✅ Si existe → ACTUALIZA
        │         │       ✅ Si NO existe → INSERTA
        │         │
        │         ├─→ retryService.execute()
        │         │   └─→ InvoiceApiClient.send()
        │         │       ├─✅ ÉXITO: API devuelve 200
        │         │       └─❌ FALLO: 503 Service Unavailable
        │         │           ┌─→ ¿Retryable? SÍ
        │         │           └─→ REINTENTA
        │         │
        │         ├─→ invoice.markAsSent()
        │         │   └─→ status = 'SENT'
        │         │
        │         └─→ repository.save()
        │             └─→ MongoDB $set actualiza status
        │                 (Mismo documento INV-001)
        │
        └─→ ✅ COMPLETADO

REINTENTO (Misma solicititud INV-001):
        │
        ├─→ SendInvoiceUseCase.execute('INV-001', 1000)
        │         │
        │         ├─→ ¿Existe INV-001 en BD? SÍ
        │         │
        │         ├─→ ¿Status='SENT'? SÍ
        │         │
        │         └─→ RETORNA INMEDIATAMENTE
        │             (La factura ya fue enviada)
        │             (NO duplica, idempotencia garantizada)
        │
        └─→ ✅ COMPLETADO (sin efectos secundarios)
```

### Garantías de Idempotencia

```
┌─────────────────────────────────────────────────────┐
│ NIVEL 1: Validación Previa                          │
│                                                     │
│ if (existing && status === 'SENT') {               │
│   return; // Previene reintento innecesario        │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ NIVEL 2: Upsert en MongoDB                          │
│                                                     │
│ updateOne(                                          │
│   { externalId },  // ← Búsqueda única             │
│   { $set: data },  // ← Actualiz a o inserta       │
│   { upsert: true } // ← Garantiza: UNO por ID      │
│ )                                                   │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ NIVEL 3: Índice UNIQUE en MongoDB                   │
│                                                     │
│ db.collection('invoices').createIndex(             │
│   { externalId: 1 },                               │
│   { unique: true }  // ← Fuerza unicidad a nivel BD │
│ );                                                  │
│                                                     │
│ Beneficio: Incluso si hay race condition,          │
│            la BD rechaza duplicados                 │
└─────────────────────────────────────────────────────┘
                      ↓
                  GARANTÍA:
        Una factura por externalId
        Ejecutable N veces sin duplicados
        100% IDEMPOTENTE
```

---

## Cómo Ejecutar

### Requisitos Previos

```bash
# MongoDB debe estar corriendo
# En Docker:
docker run -d -p 27017:27017 mongo

# O localmente (si tienes MongoDB instalado)
mongod
```

### Instalación y Ejecución

```bash
cd /Users/cbracamonte/Workspace/learning/backend/node/mid-senior/02-idempotencia

# Instalar dependencias
npm install

# Ejecutar el programa
npm run start:main
```

### Scripts Disponibles

```json
{
  "start:main": "ts-node index.ts"  // Ejecuta con ts-node
}
```

---

## Resultados Esperados

### Primera Ejecución

```
Sistema de facturación iniciado
Factura INV-001 creada (status: PENDING)
Enviando factura INV-001 a API reguladora...
✅ Factura INV-001 enviada exitosamente
Factura INV-001 actualizada (status: SENT)
Factura INV-001 ya fue enviada previamente
✅ Proceso completado correctamente
Conexión a MongoDB cerrada
```

### Verificación en MongoDB

**Después de primera ejecución:**
```javascript
db.invoices.find()

// RESULTADO:
{
  "_id": ObjectId("..."),
  "externalId": "INV-001",          ← ÚNICO
  "amount": 1000,
  "status": "SENT",                 ← ✅ ACTUALIZADO A SENT
  "createdAt": "2026-02-25T..."
}

// Solo 1 documento, aunque se ejecutó 2 veces
// ✅ IDEMPOTENCIA GARANTIZADA
```

### Comportamiento en Reintento

```
EJECUCIÓN 1:
  - Crea factura: INV-001 (status: PENDING)
  - Envía a API
  - Actualiza: status: SENT
  - RESULTADO EN BD: 1 documento con status=SENT

EJECUCIÓN 2 (reintento):
  - Descubre: INV-001 ya existe con status=SENT
  - RETORNA SIN HACER NADA
  - RESULTADO EN BD: Sigue siendo 1 documento
  
✅ CERO DUPLICADOS
✅ IDEMPOTENCIA EN ACCIÓN
```

---

## Mejores Prácticas

### ✅ Lo Que Está Bien Implementado

#### 1. Validación Previa
```typescript
const existing = await repository.findByExternalId(externalId);
if (existing && existing.status === 'SENT') {
  return;
}
```
- Evita reintentosinnecesarios
- Rápido (una query antes de procesamiento)
- User-friendly (respuesta inmediata)

#### 2. Upsert en Base de Datos
```typescript
await db.updateOne(
  { externalId },
  { $set: { ...data } },
  { upsert: true }
)
```
- Crea o actualiza atomicamente
- No requiere transacciones complejas
- Escalable en BD grande

#### 3. Índice UNIQUE
```typescript
await db.createIndex(
  { externalId: 1 },
  { unique: true }
)
```
- Enforced a nivel BD
- Previene race conditions
- Documentado en schema

#### 4. Status Rastreable
```typescript
status: 'PENDING' | 'SENT'
```
- Claridad del estado
- Permite recuperación parcial
- Auditable

### ⚠️ Límites Actuales

```typescript
// Limite: Solo soporta 1 intento
maxAttempts: 1

// Mejora futura: Permitir reintentos
maxAttempts: 3,
baseDelayMs: 500,
shouldRetry: (error) => error.code === 503
```

### 📚 Modelo de Idempotencia Ideal

```typescript
// COMPLETO: Validación + Upsert + Índice + Retry

async execute(externalId: string, amount: number) {
  // 1. VALIDACIÓN PREVIA
  const existing = await repository.findByExternalId(externalId);
  if (existing && existing.status === 'SENT') {
    logger.info(`Ya enviada: ${externalId}`);
    return;
  }

  // 2. CREAR CON UPSERT
  const invoice = new Invoice(externalId, amount, 'PENDING');
  await repository.save(invoice);

  // 3. ENVIAR CON RETRY (exponential backoff)
  await retryService.execute(
    () => invoiceApiClient.send(invoice),
    {
      maxAttempts: 3,
      baseDelayMs: 500,
      shouldRetry: (error) => error.code === 503,
      invoiceId: externalId,
      logger: this.logger,
      persistence: this.persistence, // Dead letter queue
    }
  );

  // 4. ACTUALIZAR ESTADO ATÓMICAMENTE
  invoice.markAsSent();
  await repository.save(invoice);

  // 5. REGISTRAR EN AUDITORÍA
  await auditService.log({
    action: 'INVOICE_SENT',
    invoiceId: externalId,
    timestamp: new Date(),
    status: 'SUCCESS'
  });
}
```

### 🚨 Errores Comunes a Evitar

#### ❌ Error 1: No validar previa

```typescript
// PELIGROSO: Siempre procesa
async execute(externalId, amount) {
  const invoice = new Invoice(externalId, amount, 'PENDING');
  await repository.save(invoice);
  // Si se reintenta → actualiza a PENDING nuevamente
  // Pierde el estado SENT
}
```

#### ❌ Error 2: Usar INSERT en lugar de UPSERT

```typescript
// PELIGROSO: INSERT siempre crea nuevo
await db.invoices.insert({ externalId, amount });

// Reintento:
// ERROR: Duplicate key error
// O: Crea otro documento si no hay índice unique
```

#### ❌ Error 3: Usar $setOnInsert

```typescript
// INCORRECTO: Solo actualiza al insertar, no en actualizaciones
await db.updateOne(
  { externalId },
  {
    $setOnInsert: { externalId, amount, status },  // ❌ Solo en INSERT
  },
  { upsert: true }
);

// Problema: En reintento, $setOnInsert no ejecuta
// El status NO se actualiza a SENT
```

#### ✅ Error 3 (Corregido): Usar $set

```typescript
// CORRECTO: Actualiza siempre
await db.updateOne(
  { externalId },
  {
    $set: { externalId, amount, status },  // ✅ INSERT y UPDATE
  },
  { upsert: true }
);

// Reintento: Se actualiza el status correctamente
```

---

## Conclusión

**Idempotencia** es el pilar de la confiabilidad en sistemas distribuidos:

1. **Previene duplicados** → Sin idempotencia, todo retry es un riesgo
2. **Garantiza consistencia** → Una operación = un efecto, siempre
3. **Simplifica retry logic** → No necesita manejador de errores complejo
4. **Cumple regulaciones** → Auditoría clara y verificable
5. **Escala con confianza** → Millones de facturas sin miedo a duplicados

La combinación de **validación previa + upsert + índice unique** es el estándar de la industria para sistemas que manejan datos críticos como facturación, pagos y transacciones.
