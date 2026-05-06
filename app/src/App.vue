<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppBootstrap } from './composables/useAppBootstrap'
import LocaleSection from './components/settings/LocaleSection.vue'
import TimeZoneSection from './components/settings/TimeZoneSection.vue'
import TrelloSection from './components/settings/TrelloSection.vue'

const { t } = useI18n()
const { settings, trello, timeZones, fatalMessage, isLoading, load } = useAppBootstrap()

onMounted(load)
</script>

<template>
  <main class="relative mx-auto w-full max-w-3xl p-5 pb-7">
    <Toast />
    <ConfirmDialog :pt="{ root: 'w-[calc(100%-2.5rem)]' }" />

    <section class="mb-3.5 flex items-start justify-between gap-3.5">
      <hgroup>
        <p class="mb-1 text-xs font-extrabold uppercase text-primary">
          Tale Treller
        </p>
        <h1 class="text-2xl font-bold">
          {{ t('title') }}
        </h1>
      </hgroup>
      <div class="shrink-0">
        <Badge :severity="trello.connected ? 'success' : 'warn'">
          {{ trello.connected ? t('trelloConnectedBadge') : t('trelloNotConnectedBadge') }}
        </Badge>
      </div>
    </section>

    <Message
      v-if="fatalMessage"
      severity="error">
      {{ fatalMessage }}
    </Message>
    <Message
      v-else-if="isLoading"
      severity="info">
      {{ t('loadingSettings') }}
    </Message>

    <div
      v-if="!fatalMessage && !isLoading"
      class="flex flex-col gap-3.5"
      :class="{ 'flex-col-reverse': !trello.connected }">
      <div class="flex flex-col gap-3.5">
        <LocaleSection v-model:settings="settings" />

        <TimeZoneSection
            v-model:settings="settings"
            :time-zones="timeZones" />
      </div>

      <TrelloSection
        v-model:trello="trello"
        :locale="settings.locale" />
    </div>
  </main>
</template>
