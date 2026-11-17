Pod::Spec.new do |s|
  s.name = 'MasarifiBankSms'
  s.version = '1.0.0'
  s.summary = 'Masarifi iOS Shortcuts bank SMS'
  s.homepage = 'https://masarifiratibi.com'
  s.license = { :type => 'Proprietary' }
  s.author = 'Masarifi'
  s.source = { :git => 'https://github.com/masarifiratibi-spec/masarifi.ratibi_app.git' }
  s.platforms = { :ios => '17.0' }
  s.swift_version = '5.10'
  s.static_framework = true
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    # ClerkExpo owns the Swift package product. Resolve its module from the
    # same build directory React Native uses for Swift package modules.
    'SWIFT_INCLUDE_PATHS' => '$(inherited) "${SYMROOT}/${CONFIGURATION}${EFFECTIVE_PLATFORM_NAME}/"'
  }
  s.source_files = '*.swift'
  s.frameworks = ['JavaScriptCore', 'Security', 'CryptoKit', 'UserNotifications']
  s.dependency 'ExpoModulesCore'
  s.dependency 'ClerkExpo'
end
