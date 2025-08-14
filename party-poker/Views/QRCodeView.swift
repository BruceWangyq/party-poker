//
//  QRCodeView.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import SwiftUI
import CoreImage.CIFilterBuiltins

struct QRCodeView: View {
    let room: Room
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                Text("Scan to Join")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Room: \(room.code)")
                    .font(.title2)
                    .foregroundColor(.secondary)
                
                // QR Code
                if let qrImage = generateQRCode(from: room.qrCodeData) {
                    Image(uiImage: qrImage)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 250, height: 250)
                        .background(Color.white)
                        .cornerRadius(12)
                        .shadow(radius: 5)
                } else {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 250, height: 250)
                        .cornerRadius(12)
                        .overlay(
                            Text("QR Code Error")
                                .foregroundColor(.secondary)
                        )
                }
                
                VStack(spacing: 16) {
                    Text("Or share this code:")
                        .font(.headline)
                    
                    Text(room.code)
                        .font(.system(size: 36, weight: .bold, design: .monospaced))
                        .padding()
                        .background(Color(UIColor.systemGray6))
                        .cornerRadius(12)
                    
                    Button(action: {
                        UIPasteboard.general.string = room.code
                    }) {
                        HStack {
                            Image(systemName: "doc.on.doc")
                            Text("Copy Code")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                    }
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Share Room")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
    
    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        
        filter.message = Data(string.utf8)
        
        if let outputImage = filter.outputImage {
            let transform = CGAffineTransform(scaleX: 10, y: 10)
            let scaledImage = outputImage.transformed(by: transform)
            
            if let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) {
                return UIImage(cgImage: cgImage)
            }
        }
        
        return nil
    }
}