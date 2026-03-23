import { Image, ImageStyle, StyleProp } from 'react-native';

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export default function Logo({ size = 60, style }: Props) {
  return (
    <Image
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source={require('../assets/logo.png')}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
