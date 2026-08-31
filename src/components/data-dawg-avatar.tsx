import { Image } from "expo-image"
import { StyleSheet, type StyleProp, type ImageStyle } from "react-native"

type DataDawgAvatarProps = {
  size?: number
  style?: StyleProp<ImageStyle>
}

export function DataDawgAvatar({ size = 32, style }: DataDawgAvatarProps) {
  return (
    <Image
      source={require("../../assets/images/data-dawg-avatar.webp")}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
      contentFit="cover"
      transition={150}
      accessibilityLabel="Data Dawg"
    />
  )
}

const styles = StyleSheet.create({
  avatar: {
    flexShrink: 0,
    backgroundColor: "#0A1628",
    borderWidth: 1,
    borderColor: "rgba(211, 181, 116, 0.55)",
  },
})
