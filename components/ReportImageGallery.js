import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, radius } from '../theme';

export default function ReportImageGallery({
  imageUrls = [],
  height = 200,
  showCounter = true,
  placeholderEmoji = '',
  borderRadius = radius.lg,
  style,
  imageStyle,
  counterStyle,
  counterTextStyle,
  placeholderStyle,
  placeholderTextStyle,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const normalizedImageUrls = useMemo(
    () => imageUrls.filter((url) => typeof url === 'string' && url.trim().length > 0),
    [imageUrls]
  );

  const effectiveWidth = containerWidth || windowWidth;
  const hasMultipleImages = normalizedImageUrls.length > 1;

  useEffect(() => {
    setCurrentIndex(0);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [normalizedImageUrls]);

  if (normalizedImageUrls.length === 0) {
    return (
      <View style={[styles.placeholder, { height, borderRadius }, placeholderStyle]}>
        <Text style={[styles.placeholderText, placeholderTextStyle]}>
          {placeholderEmoji || 'No image available'}
        </Text>
      </View>
    );
  }

  if (!hasMultipleImages) {
    return (
      <View
        style={[styles.container, { height, borderRadius }, style]}
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      >
        <Image
          source={{ uri: normalizedImageUrls[0] }}
          style={[styles.image, { height, borderRadius }, imageStyle]}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { height, borderRadius }, style]}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <FlatList
        ref={listRef}
        data={normalizedImageUrls}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={[styles.image, { width: effectiveWidth, height, borderRadius }, imageStyle]}
            resizeMode="cover"
          />
        )}
        onMomentumScrollEnd={(event) => {
          const itemWidth = event.nativeEvent.layoutMeasurement.width || effectiveWidth;
          const nextIndex = itemWidth > 0 ? Math.round(event.nativeEvent.contentOffset.x / itemWidth) : 0;
          setCurrentIndex(Math.max(0, Math.min(nextIndex, normalizedImageUrls.length - 1)));
        }}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
      />

      {showCounter ? (
        <View style={[styles.counter, counterStyle]}>
          <Text style={[styles.counterText, counterTextStyle]}>
            {currentIndex + 1} / {normalizedImageUrls.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  image: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  counter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(17, 17, 17, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
