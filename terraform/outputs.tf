output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.app.id
}

output "instance_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_eip.app.public_ip
}

output "application_url" {
  description = "URL to access the application"
  value       = "http://${aws_eip.app.public_ip}:3000"
}

output "site_url" {
  description = "URL to check deployment status"
  value       = "http://${aws_eip.app.public_ip}"
}

output "cloudwatch_logs" {
  description = "CloudWatch log group for debugging"
  value       = aws_cloudwatch_log_group.user_data_logs.name
}

output "debug_commands" {
  description = "Commands to debug the deployment"
  value       = <<-EOT
    # Check CloudWatch logs:
    aws logs tail ${aws_cloudwatch_log_group.user_data_logs.name} --follow
    
    # Get console output:
    aws ec2 get-console-output --instance-id ${aws_instance.app.id} --output text
    
    # Connect via Session Manager:
    aws ssm start-session --target ${aws_instance.app.id}
    
    # Check the site:
    curl http://${aws_eip.app.public_ip}
  EOT
}
