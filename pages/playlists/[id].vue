<template>
  <ResponsiveViewSwitch>
    <template #mobile>
      <component :is="mobileDetailComponent" />
    </template>

    <template #desktop>
      <BookGroupDetail
        back-to="/playlists"
        :books="playlistBooks"
        :title="playlist?.name || 'Playlist'"
        kicker="Your playlist"
        empty-title="No books here yet"
        empty-description="Add books to this playlist from the Books page."
        empty-icon="ri-play-list-2-line"
        title-editable
        @edit-title="editingPlaylist = playlist"
      />
      <PlaylistEditModal
        v-if="editingPlaylist"
        :playlist="editingPlaylist"
        :saving="savingPlaylist"
        @close="editingPlaylist = null"
        @save="savePlaylist"
      />
    </template>
  </ResponsiveViewSwitch>
</template>

<script setup>
import { computed, ref } from 'vue';
import PlaylistDetailMobile from '~/components/mobile/PlaylistDetailMobile.vue';
import BookGroupDetail from '~/components/shared/BookGroupDetail.vue';
import PlaylistEditModal from '~/components/shared/PlaylistEditModal.vue';
import ResponsiveViewSwitch from '~/components/shared/ResponsiveViewSwitch.vue';
import { useBooks } from '~/composables/useBooks';
import { useToast } from '~/composables/useToast';

const mobileDetailComponent = PlaylistDetailMobile;
const route = useRoute();
const { books, collections, updatePlaylist } = useBooks();
const { addToast } = useToast();
const editingPlaylist = ref(null);
const savingPlaylist = ref(false);

const playlist = computed(() => (
  collections.value.find((item) => String(item.id) === String(route.params.id))
));

const playlistBooks = computed(() => {
  const ids = playlist.value?.bookIds || [];
  return ids
    .map((id) => books.value.find((book) => String(book.id) === String(id)))
    .filter(Boolean);
});

const savePlaylist = async (updatedPlaylist) => {
  savingPlaylist.value = true;
  try {
    await updatePlaylist(updatedPlaylist);
    addToast('Playlist updated', 'success');
    editingPlaylist.value = null;
  } catch {
    addToast('Could not update playlist', 'error');
  } finally {
    savingPlaylist.value = false;
  }
};
</script>
