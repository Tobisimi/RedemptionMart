export function sellerMapUrl(params: {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  if (params.latitude != null && params.longitude != null) {
    return `https://www.openstreetmap.org/?mlat=${params.latitude}&mlon=${params.longitude}#map=17/${params.latitude}/${params.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(params.address)}`;
}

export function sellerMapEmbedUrl(params: {
  latitude: number;
  longitude: number;
}): string {
  const { latitude, longitude } = params;
  const delta = 0.01;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(
    ","
  );
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}
