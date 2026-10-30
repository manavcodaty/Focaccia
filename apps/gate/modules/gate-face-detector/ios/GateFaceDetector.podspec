Pod::Spec.new do |s|
  s.name = 'GateFaceDetector'
  s.version = '1.0.0'
  s.summary = 'On-device face observations for gate verification'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'PrivatePass'
  s.homepage = 'https://expo.dev'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
end
