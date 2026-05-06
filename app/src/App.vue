<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {useConfirm} from "primevue/useconfirm";
import {useToast} from "primevue/usetoast";

type TimeZoneOption = {
  name: string;
  offset: string;
};

type SettingsPayload = {
  timeZone: string | null;
  isDefaultTimeZone: boolean;
  defaultTimeZone: string;
};

type TrelloPayload = {
  connected: boolean;
  username: string | null;
  expiresAt: string | null;
  expired: boolean;
};

type AppPayload = {
  settings: SettingsPayload;
  trello: TrelloPayload;
};

const toast = useToast();
const confirm = useConfirm();

const telegramInitData = ref("");
const settings = ref<SettingsPayload>({
  timeZone: null,
  isDefaultTimeZone: true,
  defaultTimeZone: "UTC"
});
const trello = ref<TrelloPayload>({
  connected: false,
  username: null,
  expiresAt: null,
  expired: false
});
const timeZones = ref<TimeZoneOption[]>([]);
const filteredTimeZones = ref<TimeZoneOption[]>([]);
const selectedTimeZone = ref<TimeZoneOption | null>(null);
const detectMessage = ref("");
const detectSeverity = ref<"success" | "warn">("success");
const fatalMessage = ref("");
const isLoading = ref(true);
const isSavingSettings = ref(false);
const isCreatingConnectLink = ref(false);
const isDisconnecting = ref(false);

const trelloSummary = computed(() => {
  if (trello.value.connected) {
    const expires = trello.value.expiresAt ? formatDateTime(trello.value.expiresAt) : "срок неизвестен";
    return `@${trello.value.username ?? "unknown"}, действует до ${expires}.`;
  }

  if (trello.value.expired) {
    return "Подключение истекло, нужно переподключить аккаунт.";
  }

  return "Подключите Trello, чтобы создавать карточки.";
});

onMounted(async () => {
  window.Telegram?.WebApp?.ready();
  window.Telegram?.WebApp?.expand();
  window.Telegram?.WebApp?.MainButton?.hide();

  try {
    telegramInitData.value = window.Telegram?.WebApp?.initData ?? "";

    if (!telegramInitData.value) {
      fatalMessage.value = "Откройте приложение из Telegram.";
      return;
    }

    const [sessionPayload, timeZonePayload] = await Promise.all([
      apiRequest<AppPayload>("/api/app/me"),
      fetch("/api/app/time-zones").then((response) => response.json() as Promise<{ timeZones: TimeZoneOption[] }>)
    ]);

    settings.value = sessionPayload.settings;
    trello.value = sessionPayload.trello;
    timeZones.value = timeZonePayload.timeZones;
    filteredTimeZones.value = timeZonePayload.timeZones.slice(0, 25);
    selectedTimeZone.value = findTimeZone(settings.value.timeZone ?? settings.value.defaultTimeZone);
  } catch (error) {
    fatalMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
});

function searchTimeZones(event: { query: string }): void {
  const query = event.query.trim().toLowerCase();
  if (!query) {
    filteredTimeZones.value = timeZones.value;
    return;
  }

  filteredTimeZones.value = timeZones.value
      .filter((option) => option.name.toLowerCase().includes(query) || option.offset.toLowerCase().includes(query))
}

async function detectTimeZone(): Promise<void> {
  if (isSavingSettings.value) {
    return;
  }

  detectMessage.value = "";

  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const option = detected ? findTimeZone(detected) : null;

  if (!option) {
    detectSeverity.value = "warn";
    detectMessage.value = "Не удалось определить часовой пояс. Выберите его вручную в списке.";
    return;
  }

  selectedTimeZone.value = option;
  await saveTimeZone(option);
}

async function handleTimeZoneSelect(event: { value: TimeZoneOption }): Promise<void> {
  detectMessage.value = ''
  await saveTimeZone(event.value);
}

async function saveTimeZone(option: TimeZoneOption | null): Promise<void> {
  if (!option || option.name === settings.value.timeZone || isSavingSettings.value) {
    return;
  }

  detectMessage.value = "";
  isSavingSettings.value = true;
  try {
    const payload = await apiRequest<{ settings: SettingsPayload }>("/api/app/settings", {
      method: "PATCH",
      body: JSON.stringify({timeZone: option.name})
    });
    settings.value = payload.settings;
    selectedTimeZone.value = findTimeZone(payload.settings.timeZone ?? payload.settings.defaultTimeZone);
    toast.add({severity: "success", summary: "Сохранено", detail: "Часовой пояс обновлен.", life: 2600});
  } catch (error) {
    selectedTimeZone.value = findTimeZone(settings.value.timeZone ?? settings.value.defaultTimeZone);
    toast.add({severity: "error", summary: "Ошибка", detail: getErrorMessage(error), life: 4000});
  } finally {
    isSavingSettings.value = false;
  }
}

async function openTrelloConnect(): Promise<void> {
  isCreatingConnectLink.value = true;
  try {
    const payload = await apiRequest<{ url: string }>("/api/app/trello/connect-link", {method: "POST"});
    window.location.href = payload.url;
  } catch (error) {
    toast.add({severity: "error", summary: "Ошибка", detail: getErrorMessage(error), life: 4000});
  } finally {
    isCreatingConnectLink.value = false;
  }
}

function confirmDisconnect(): void {
  confirm.require({
    message: "Отключить Trello для этого Telegram-пользователя?",
    header: "Отключить Trello",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Отключить",
    acceptClass: "p-button-danger",
    rejectLabel: "Отмена",
    rejectClass: "p-button-secondary",
    accept: disconnectTrello
  });
}

async function disconnectTrello(): Promise<void> {
  isDisconnecting.value = true;
  try {
    const payload = await apiRequest<{ trello: TrelloPayload }>("/api/app/trello/disconnect", {method: "POST"});
    trello.value = payload.trello;
    toast.add({severity: "success", summary: "Готово", detail: "Trello отключен.", life: 2600});
  } catch (error) {
    toast.add({severity: "error", summary: "Ошибка", detail: getErrorMessage(error), life: 4000});
  } finally {
    isDisconnecting.value = false;
  }
}

async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (telegramInitData.value) {
    headers.set("X-Telegram-Init-Data", telegramInitData.value);
  }

  const response = await fetch(url, {...init, headers});
  const payload = (await response.json()) as { ok?: boolean; message?: string } & T;
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || "Запрос не выполнен.");
  }

  return payload;
}

function findTimeZone(value: string | null): TimeZoneOption | null {
  if (!value) {
    return null;
  }

  return timeZones.value.find((option) => option.name === value) ?? null;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка.";
}

</script>
width
<template>
  <main class="relative mx-auto w-full max-w-3xl p-5 pb-7">
    <Toast/>
    <ConfirmDialog :pt="{root: 'w-[calc(100%-2.5rem)]',}"/>

    <section class="mb-3.5 flex items-start justify-between gap-3.5">
      <hgroup>
        <p class="mb-1 text-xs font-extrabold uppercase text-primary">Tale Treller</p>
        <h1 class="text-2xl font-bold">Настройки</h1>
      </hgroup>
      <div class="shrink-0">
        <Badge :severity="trello.connected ? 'success' : 'warn'">
          {{ trello.connected ? "Trello подключен" : "Trello не подключен" }}
        </Badge>
      </div>
    </section>

    <!--  Loading & Error states  -->
    <Message v-if="fatalMessage" severity="error">{{ fatalMessage }}</Message>
    <Message v-else-if="isLoading" severity="info">Загружаю настройки...</Message>

    <!-- Loaded settings   -->
    <div v-else
         class="flex flex-col gap-3.5"
         :class="{'flex-col-reverse': !trello.connected}">
      <!--   App settings   -->
      <div>
        <!--    Timezone  -->
        <section
            class="p-4 rounded-lg border border-secondary/10 bg-white shadow-md shadow-secondary/5"
        >
          <div class="mb-3.5 flex items-start justify-between gap-3">
            <div>
              <h2 class="text-md font-bold">Часовой пояс</h2>
              <p class="mt-2 text-xs text-secondary">
                Используется для распознавания сроков в задачах.
              </p>
            </div>
          </div>

          <div class="mb-2.5 flex items-start gap-2">
            <AutoComplete
                v-model="selectedTimeZone"
                :suggestions="filteredTimeZones"
                :disabled="isSavingSettings"
                class="grow"
                option-label="name"
                dropdown
                force-selection
                placeholder="Найти город или IANA timezone"
                @complete="searchTimeZones"
                @option-select="handleTimeZoneSelect"
            >
              <template #option="slotProps">
                <div class="flex items-center justify-between gap-2 w-full">
                  <span>{{ slotProps.option.name }}</span>
                  <Badge severity="info" size="small">{{ slotProps.option.offset }}</Badge>
                </div>
              </template>
            </AutoComplete>
            <Button
                class="shrink-0"
                icon="pi pi-compass"
                severity="secondary"
                aria-label="Определить автоматически"
                :loading="isSavingSettings"
                v-tooltip.bottom="'Определить автоматически'"
                @click="detectTimeZone"
            />
          </div>

          <Message v-if="detectMessage" :severity="detectSeverity" :closable="false">
            {{ detectMessage }}
          </Message>
        </section>
      </div>

      <!--  Trello    -->
      <section
          class="p-4 rounded-lg border border-secondary/10 bg-[linear-gradient(135deg,rgba(224,242,254,0.92),rgba(245,243,255,0.76)),#fff]"
      >
        <div class="mb-3.5 flex items-start justify-between gap-3 max-[520px]:block">
          <div>
            <h2 class="text-md font-bold">Trello</h2>
            <p class="mt-2 text-xs text-secondary">{{ trelloSummary }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-2.5 w-full">
          <Button
              :label="trello.connected ? 'Переподключить Trello' : 'Подключить Trello'"
              icon="pi pi-external-link"
              :loading="isCreatingConnectLink"
              @click="openTrelloConnect"
          />
          <Button
              v-if="trello.connected || trello.username"
              label="Отключить"
              icon="pi pi-times"
              severity="danger"
              outlined
              :loading="isDisconnecting"
              @click="confirmDisconnect"
          />
        </div>
      </section>
    </div>
  </main>
</template>
