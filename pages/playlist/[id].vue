<template>
  <BookGroupDetail
    back-to="/playlists"
    :books="playlistBooks"
    :title="playlist?.name || 'Playlist'"
    kicker="Your playlist"
    :description="playlist?.description || ''"
    empty-title="No books here yet"
    empty-description="Add books to this playlist from the Books page."
    empty-icon="ri-play-list-2-line"
  />
</template>

<script setup>
import { computed } from 'vue';
import BookGroupDetail from '~/components/BookGroupDetail.vue';
import { useBooks } from '~/composables/useBooks';

const route = useRoute();
const { books, collections } = useBooks();

const playlist = computed(() => (
  collections.value.find((item) => String(item.id) === String(route.params.id))
));

const playlistBooks = computed(() => {
  const ids = playlist.value?.bookIds || [];
  return ids
    .map((id) => books.value.find((book) => String(book.id) === String(id)))
    .filter(Boolean);
});
</script>
